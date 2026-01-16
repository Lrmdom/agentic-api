import {Hono} from "hono";
import {getMcpManagerInstance, getAvailableTools} from "../servers.js";
// Importações de Analytics (carregado dinamicamente para evitar ENOENT)
// import {
//     runAnalyticsReport,
//     runRealtimeReport,
// } from "../../services/analytics.js";
import {GoogleGenerativeAI} from "@google/generative-ai";

// Tratamento de erros globais
process.on("uncaughtException", (err) => {
    console.error("💥 CRASH FATAL (Uncaught Exception):", err.message);
    process.exit(1);
});

function sanitizeToolName(name: string): string {
    let clean = name.replace(/[^a-zA-Z0-9_.:-]/g, "_");
    if (!/^[a-zA-Z_]/.test(clean)) clean = "tool_" + clean;
    return clean.slice(0, 64);
}

function cleanSchema(schema: any): any {
    if (!schema || typeof schema !== "object") {
        return {type: "object", properties: {}};
    }

    const newSchema: any = {
        type: "object",
        properties: {} // ✅ Garante que isto existe sempre
    };

    // Se o esquema original já tem propriedades, limpamos cada uma delas
    if (schema.properties && Object.keys(schema.properties).length > 0) {
        for (const key in schema.properties) {
            newSchema.properties[key] = cleanSchema(schema.properties[key]);
        }
        if (schema.required) newSchema.required = schema.required;
    } else {
        // Se não há propriedades, removemos o campo 'required' para evitar esquemas inválidos
        delete newSchema.required;
    }

    if (schema.description) newSchema.description = schema.description;

    return newSchema;
}

const app = new Hono();

// Tools Internas
const googleAnalyticsTool = {
    name: "internal_get_google_analytics_report",
    description: "Obtém dados de tráfego do Google Analytics GA4.",
    parameters: {
        type: "object",
        properties: {
            days: {type: "number", description: "Período em dias"},
            limit: {type: "number", description: "Máximo de resultados"},
        },
    },
};

const googleRealtimeTool = {
    name: "internal_get_realtime_traffic",
    description: "Obtém os utilizadores ativos no site AGORA.",
    parameters: {
        type: "object",
        properties: {
            limit: {type: "number", description: "Máximo de resultados"},
        },
    },
};

app.post("/chat", async (c) => {
    try {
        const {message} = await c.req.json();
        const mcpManager = await getMcpManagerInstance();
        const availableToolsMap = await getAvailableTools();

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({model: "gemini-2.0-flash"});

        const functionDeclarations: any[] = [
            {
                name: sanitizeToolName(googleAnalyticsTool.name),
                description: googleAnalyticsTool.description,
                parameters: cleanSchema(googleAnalyticsTool.parameters)
            },
            {
                name: sanitizeToolName(googleRealtimeTool.name),
                description: googleRealtimeTool.description,
                parameters: cleanSchema(googleRealtimeTool.parameters)
            }
        ];

        const toolToManagerMap: Record<string, { server: string, originalName: string }> = {};

        for (const [serverName, tools] of Object.entries(availableToolsMap)) {
            if (Array.isArray(tools)) {
                for (const t of tools) {
                    const sanitized = sanitizeToolName(`${serverName}_${t.name}`);

                    // Forçamos a limpeza através do cleanSchema mesmo que pareça ter dados
                    // O cleanSchema agora garante o formato { type: "object", properties: {} }
                    const finalParameters = cleanSchema(t.inputSchema);

                    functionDeclarations.push({
                        name: sanitized,
                        description: t.description || `Tool ${t.name}`,
                        parameters: finalParameters
                    });

                    toolToManagerMap[sanitized] = {
                        server: serverName,
                        originalName: t.name
                    };
                }
            }
        }

        // Primeira chamada
        const result = await model.generateContent({
            contents: [{role: "user", parts: [{text: message}]}],
            tools: [{functionDeclarations}]
        });

        const response = result.response;
        const functionCalls = response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
            const toolResults = [];

            for (const call of functionCalls) {
                const toolName = call.name;
                const args = call.args as any;
                let rawResponse;

                try {
                    if (toolName === sanitizeToolName(googleAnalyticsTool.name)) {
                        // Importação dinâmica para evitar carregamento em produção
                        const { runAnalyticsReport } = await import("../../services/analytics.js");
                        rawResponse = await runAnalyticsReport(args.days || 7, args.limit || 10);
                    } else if (toolName === sanitizeToolName(googleRealtimeTool.name)) {
                        // Importação dinâmica para evitar carregamento em produção
                        const { runRealtimeReport } = await import("../../services/analytics.js");
                        rawResponse = await runRealtimeReport(args.limit || 10);
                    } else {
                        const mapping = toolToManagerMap[toolName];
                        if (mapping) {
                            rawResponse = await mcpManager.callTool(mapping.server, mapping.originalName, args);
                        } else {
                            throw new Error(`Tool ${toolName} not found`);
                        }
                    }

                    // ✅ CORREÇÃO AQUI: Garante que é um objeto {} e não uma lista []
                    const safeResponse = (Array.isArray(rawResponse) || typeof rawResponse !== 'object')
                        ? {output: rawResponse}
                        : rawResponse;

                    toolResults.push({
                        functionResponse: {name: toolName, response: safeResponse}
                    });
                } catch (err: any) {
                    toolResults.push({
                        functionResponse: {name: toolName, response: {error: err.message}}
                    });
                }
            }

            // Segunda chamada (Histórico completo é obrigatório)
            const finalResult = await model.generateContent({
                contents: [
                    {role: "user", parts: [{text: message}]},
                    {role: "model", parts: response.candidates?.[0]?.content?.parts || []},
                    {role: "function", parts: toolResults}
                ]
            });

            return c.json({reply: finalResult.response.text()});
        }

        return c.json({reply: response.text()});

    } catch (error: any) {
        console.error("❌ Erro /chat:", error);
        return c.json({error: error.message}, 500);
    }
});

export default app;