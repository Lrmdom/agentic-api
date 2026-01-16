import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });

// index.ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";

// Importações de Analytics (carregado apenas quando necessário)
// import { runRealtimeReport, runAnalyticsReport } from "./mcp/analytics.js";

// Importações do ecossistema Hono/PubSub
import event from "./receive-clayer-event.js";
import priceCalculator from "./external-price.js";
import validateOrder from "./validate-order.js";
import sanityPubsub from "./sanity-pubsub.js";
import pubsubClayer from "./pubsub-clayer.js";
import availabilityCheck from "./availability-check.js";
import resourceCalendar from "./resource-calendar.js";
import sanityDataBucket from "./ridesrent-sanity-data-bucket.js";
import clayerOrderToInvoice from "./clayer-order-to-invoice.js";
import calcularPremio from "./calcular-premio.js";
import documentUpload from "./document-upload.js";
import registerProfile from "./register-profile.js";
import spbsSyncServicesUser from "./spbs-sync-services-user.js";
import clayerAddressToProfiles from "./clayer-address-to-profiles.js";
import clayerCustomerToProfiles from "./clayer-customer-to-profiles.js";
import verifyTurnstile from "./verify-turnstile.js";
import bizzbricksSanityDataBucket from "./bizzbricks-sanity-data-bucket.js";
import pushNotificationsSubscribe from "./push-notifications-subscribe.js";
import heritageSanityDataBucket from "./heritage-sanity-data-bucket.js";
import { chatRouter } from "./routes/chat.js";
import { nativeToolsRouter } from "./routes/native-tools.js";
import mcpApi from "./mcp/api/mcp.js";
import { ManualRetriever } from "./manual-retriever.js";

// 1. Inicialização do Genkit
export const ai = genkit({
    plugins: [
        googleAI({apiKey: process.env.GEMINI_API_KEY}),
    ],
});

// 1.5. Inicializar Manual Retriever
const manualRetriever = new ManualRetriever(ai);

// 1.6. Tool de busca nos manuais
const manualSearchTool = manualRetriever.createRetrieverTool();

// 2. Tool Analytics Nativa
const analyticsTool = ai.defineTool(
    {
        name: "googleAnalytics",
        description: "Consulta dados do Google Analytics 4",
        inputSchema: z.object({
            type: z.enum(["realtime", "historic"]),
            days: z.number().optional().default(7),
        }),
    },
    async (input) => {
        // Importação dinâmica para evitar carregamento em produção
        const { runRealtimeReport, runAnalyticsReport } = await import("./mcp/analytics.js");
        
        if (input.type === "realtime") return await runRealtimeReport();
        return await runAnalyticsReport(input.days);
    }
);

// --- GESTÃO DINÂMICA DE MCP ---

let mcpContext: any = null;
let registeredMcpTools: any[] = [];

/**
 * Obtém o contexto MCP sincronizado com o servers.ts
 * Resolve o erro de Property 'mcpManager' does not exist
 */
async function getMcp() {
    if (mcpContext) return mcpContext;
    
    // Importa o módulo corrigido
    const mcpModule = await import("./mcp/servers.js");
    
    // Obtém a instância real do objeto mcpManager
    const mcpInstance = await mcpModule.getMcpManagerInstance();
    
    mcpContext = {
        initializeMCPServers: mcpModule.initializeMCPServers,
        mcpManager: mcpInstance, 
        getServerNames: mcpModule.getServerNames
    };
    
    return mcpContext;
}

/**
 * Mapeia ferramentas MCP para o Genkit
 */
async function getAllMcpTools() {
    if (registeredMcpTools.length > 0) return registeredMcpTools;

    const mcp = await getMcp();
    const serverNames = mcp.getServerNames();
    const tools = [];

    for (const serverName of serverNames) {
        try {
            console.log(`🔍 Tentando listar ferramentas de: ${serverName}`);
            
            // 1. Timeout de 5 segundos para evitar que o servidor "congele" no arranque
            const listToolsPromise = mcp.mcpManager.listTools(serverName);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout ao listar ferramentas')), 5000)
            );

            // 2. Executa com proteção contra o erro de 'undefined' (reading tools)
            const mcpTools = await Promise.race([listToolsPromise, timeoutPromise]) as any;

            if (!mcpTools || !Array.isArray(mcpTools)) {
                console.warn(`⚠️ O servidor ${serverName} retornou um formato inválido.`);
                continue;
            }

            for (const t of mcpTools) {
                if (!t?.name) continue;
                const sanitizedName = `${serverName}_${t.name}`.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 64);

                const tool = ai.defineTool(
                    {
                        name: sanitizedName,
                        description: t.description || `Executa ${t.name} no servidor ${serverName}`,
                        inputSchema: z.unknown(),
                    },
                    async (input) => {
                        const mcpCtx = await getMcp();
                        return await mcpCtx.mcpManager.callTool(serverName, t.name, input);
                    }
                );
                tools.push(tool);
            }
            console.log(`✅ ${serverName}: ${mcpTools.length} ferramentas registadas.`);
        } catch (e: any) {
            // 3. Captura o erro específico do Brevo (reading tools) sem crashar o app
            console.error(`❌ Servidor ${serverName} ignorado: ${e.message}`);
        }
        
        // Pequena pausa entre servidores para não sobrecarregar a rede
        await new Promise(r => setTimeout(r, 200));
    }
    
    registeredMcpTools = tools;
    return tools;
}

const agentFlow = ai.defineFlow(
    {
        name: 'agentFlow',
        inputSchema: z.string(),
        outputSchema: z.string(),
    },
    async (prompt) => {
        const mcpTools = await getAllMcpTools();

        // @ts-ignore
        const response = await ai.generate({
            model: 'googleai/gemini-2.0-flash',
            prompt: prompt,
            system: `
                És um Especialista em Dados com acesso a ferramentas reais e manuais técnicos de motocicletas. 
                Sempre que um utilizador pedir para "cruzar dados", deves:
                1. Identificar as ferramentas necessárias.
                2. Chamar as ferramentas em sequência.
                3. NÃO DIGAS que não podes fazer. Tenta sempre usar as ferramentas disponíveis.
                
                Para perguntas sobre especificações técnicas, manutenção ou informações dos manuais:
                1. Usa PRIMEIRO a ferramenta searchManuals para consultar os manuais técnicos.
                2. Se não encontrar informação relevante na primeira tentativa, REFORMULA a query de busca automaticamente.
                3. Tenta até 3 vezes com diferentes abordagens antes de desistir.
                4. Usa sinónimos, termos mais genéricos, ou foca em aspectos diferentes.
                5. Exemplo: se "capacidade depósito" não funcionar, tenta "tamanho tanque", "volume combustível", "autonomia".
                6. Depois complementa com outras ferramentas se necessário.
            `,
            tools: [analyticsTool, manualSearchTool, ...mcpTools],
            maxSteps: 5,
            config: { 
                temperature: 0,

            }
        });

        return response.text;
    }
);

// --- SERVIDOR HONO ---
const app = new Hono();

app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Atualiza a rota para aceitar 'message' ou 'question'
app.post('/ask', async (c) => {
    const body = await c.req.json();
    // Aceita ambas as chaves para evitar erros de integração
    const query = body.message || body.question; 
    
    if (!query) return c.json({ error: "No message provided" }, 400);

    const result = await agentFlow(query);
    return c.json({ result });
});

// Endpoint para indexar manuais
app.post('/index-manuals', async (c) => {
    try {
        await manualRetriever.indexManuals();
        return c.json({ 
            success: true, 
            message: "Manuais indexados com sucesso!" 
        });
    } catch (error: any) {
        console.error("Erro ao indexar manuais:", error);
        return c.json({ 
            success: false, 
            error: error.message 
        }, 500);
    }
});

// Rotas legadas e utilitários
app.route("/spbs-sync-services-user", spbsSyncServicesUser);
app.route("/document-upload", documentUpload);
app.route("/calcular-premio", calcularPremio);
app.route("/clayer-order-to-invoice", clayerOrderToInvoice);
app.route("/push-notifications-subscribe", pushNotificationsSubscribe);
app.route("/bizzbricks-sanity-data-bucket", bizzbricksSanityDataBucket);
app.route("/ridesrent-sanity-data-bucket", sanityDataBucket);
app.route("/heritage-sanity-data-bucket", heritageSanityDataBucket);
app.route("/resource-calendar", resourceCalendar);
app.route("/availability-check", availabilityCheck);
app.route("/sanity-pubsub", sanityPubsub);
app.route("/pubsub-clayer", pubsubClayer);
app.route("/receive-clayer-event", event);
app.route("/validate-order", validateOrder);
app.route("/external-price", priceCalculator);
app.route("/register-profile", registerProfile);
app.route("/clayer-address-to-profiles", clayerAddressToProfiles);
app.route("/clayer-customer-to-profiles", clayerCustomerToProfiles);
app.route("/verify-turnstile", verifyTurnstile);
app.route("/api", chatRouter);
app.route("/native-tools", nativeToolsRouter);
app.route("/mcp", mcpApi);

// 5. Inicialização do Servidor
(async () => {
    console.log("🛠️  Iniciando Ecossistema...");
    
    const isProd = process.env.NODE_ENV === 'production' || process.env.K_SERVICE;
    
    try {
        const mcp = await getMcp();
        
        console.log("🔄 Initializing MCP servers...");
        await mcp.initializeMCPServers();
        
        // Aguarda estabilização dos processos filhos
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log("⏳ MCP servers estabilizados");
        
        // Em desenvolvimento, pré-carrega ferramentas para a Genkit UI
        if (!isProd) {
            console.log("🎯 Registando ferramentas na Genkit UI...");
            await getAllMcpTools();
        }

        console.log("📦 MCP Ecosystem Ready");
    } catch (error) {
        console.error("❌ Erro no arranque do MCP:", error);
    }

   // ✅ Adiciona 'hostname: 0.0.0.0' para o Cloud Run aceitar ligações externas
serve({
  fetch: app.fetch,
  port: parseInt(process.env.PORT || '8080'),
  hostname: '0.0.0.0' // <-- ESTA É A CHAVE
}, (info) => {
  console.log(`🚀 API: http://0.0.0.0:${info.port}`);

  const isActuallyProd = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;

  if (!isActuallyProd) {
      console.log(`📊 Genkit UI: http://localhost:4001`);
  } else {
      console.log(`🔒 Genkit UI desativada em modo produção.`);
  }
});
})();