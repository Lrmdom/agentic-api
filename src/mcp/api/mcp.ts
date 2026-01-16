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

        // Primeira chamada com system prompt melhorado
        const systemPrompt = `
            És um Especialista em Dados com acesso a ferramentas reais e manuais técnicos de motocicletas. 
            Sempre que um utilizador pedir para "cruzar dados", deves:
            1. Identificar as ferramentas necessárias.
            2. Chamar as ferramentas em sequência.
            3. NÃO DIGAS que não podes fazer. Tenta sempre usar as ferramentas disponíveis.
            
            Para perguntas sobre especificações técnicas, manutenção ou informações dos manuais:
            1. Usa PRIMEIRO as ferramentas de manuais (search_manuals, get_model_info).
            2. Se não encontrar informação relevante na primeira tentativa, REFORMULA a query de busca automaticamente.
            3. Tenta até 3 vezes com diferentes abordagens antes de desistir.
            4. Usa sinónimos, termos mais genéricos, ou foca em aspectos diferentes.
            5. Exemplo: se "capacidade depósito" não funcionar, tenta "tamanho tanque", "volume combustível", "autonomia".
            6. Depois complementa com outras ferramentas se necessário.
        `;

        const result = await model.generateContent({
            contents: [
                {role: "user", parts: [{text: systemPrompt + "\n\nPergunta do utilizador: " + message}]}
            ],
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

            // Segunda chamada com system prompt e contexto completo
            const finalSystemPrompt = `
                Analisa os resultados das ferramentas e responde à pergunta do utilizador.
                
                Se os resultados das ferramentas de manuais não tiverem informação relevante:
                1. Identifica o que foi procurado vs o que foi encontrado
                2. Se ainda não tentou suficientes alternativas, FAZ NOVAS CHAMADAS de ferramentas
                3. Usa diferentes termos: "capacidade depósito", "volume combustível", "tamanho tanque", "autonomia"
                4. Seja transparente sobre as tentativas realizadas
                5. Continue tentando até encontrar informação relevante ou esgotar 3 tentativas
                
                IMPORTANTE: Você PODE e DEVE fazer chamadas de ferramentas adicionais se as primeiras não funcionarem.
            `;

            // Permitir múltiplas chamadas de ferramentas na segunda fase
            const secondResult = await model.generateContent({
                contents: [
                    {role: "user", parts: [{text: finalSystemPrompt + "\n\nContexto original: " + message}]},
                    {role: "model", parts: response.candidates?.[0]?.content?.parts || []},
                    {role: "function", parts: toolResults}
                ],
                tools: [{functionDeclarations}]
            });

            const secondResponse = secondResult.response;
            const secondFunctionCalls = secondResponse.functionCalls();

            if (secondFunctionCalls && secondFunctionCalls.length > 0) {
                const secondToolResults = [...toolResults];

                for (const call of secondFunctionCalls) {
                    const toolName = call.name;
                    const args = call.args as any;
                    let rawResponse;

                    try {
                        if (toolName === sanitizeToolName(googleAnalyticsTool.name)) {
                            const { runAnalyticsReport } = await import("../../services/analytics.js");
                            rawResponse = await runAnalyticsReport(args.days || 7, args.limit || 10);
                        } else if (toolName === sanitizeToolName(googleRealtimeTool.name)) {
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

                        const safeResponse = (Array.isArray(rawResponse) || typeof rawResponse !== 'object')
                            ? {output: rawResponse}
                            : rawResponse;

                        secondToolResults.push({
                            functionResponse: {name: toolName, response: safeResponse}
                        });
                    } catch (err: any) {
                        secondToolResults.push({
                            functionResponse: {name: toolName, response: {error: err.message}}
                        });
                    }
                }

                // Terceira chamada final com todos os resultados
                const finalResult = await model.generateContent({
                    contents: [
                        {role: "user", parts: [{text: "Com base em todas as tentativas, responda à pergunta original: " + message}]},
                        {role: "model", parts: response.candidates?.[0]?.content?.parts || []},
                        {role: "function", parts: secondToolResults}
                    ]
                });

                return c.json({reply: finalResult.response.text()});
            }

            return c.json({reply: secondResponse.text()});
        }

        return c.json({reply: response.text()});

    } catch (error: any) {
        console.error("❌ Erro /chat:", error);
        return c.json({error: error.message}, 500);
    }
});

export default app;