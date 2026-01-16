import { createMarketingOS } from "../graph.js";

process.on("uncaughtException", (err) => {
  console.error("💥 CRASH FATAL (Uncaught Exception):", err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 REJEIÇÃO NÃO TRATADA em:", promise, "razão:", reason);
});
function sanitizeToolName(name: string): string {
  // 1. Remove caracteres que não sejam alfanuméricos, _, ., : ou -
  let clean = name.replace(/[^a-zA-Z0-9_.:-]/g, "_");

  // 2. Garante que começa com letra ou underscore
  if (!/^[a-zA-Z_]/.test(clean)) {
    clean = "tool_" + clean;
  }

  // 3. Corta para o máximo de 64 caracteres (limite do Gemini)
  return clean.slice(0, 64);
}
function cleanSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;

  // Criamos uma cópia limpa
  const newSchema: any = {};

  // Lista de campos permitidos pelo Gemini em FunctionDeclaration
  // Se o campo for 'type', 'properties', ou 'required', nós mantemos.
  if (schema.type) newSchema.type = schema.type;
  if (schema.properties) {
    newSchema.properties = {};
    for (const key in schema.properties) {
      newSchema.properties[key] = cleanSchema(schema.properties[key]);
    }
  }
  if (schema.required) newSchema.required = schema.required;
  if (schema.items) newSchema.items = cleanSchema(schema.items);
  if (schema.description) newSchema.description = schema.description;

  // Nota: Campos como $schema, additionalProperties, default, etc,
  // são ignorados e não entram no newSchema.

  return newSchema;
}

import { Hono } from "hono";
import { getMcpManagerInstance, getAvailableTools } from "../servers.js";
import {
  runAnalyticsReport,
  runRealtimeReport,
} from "../../services/analytics.js"; // IMPORTA O TEU NOVO SERVIÇO

const app = new Hono();

// --- DEFINIÇÃO DA TOOL INTERNA ---
const googleAnalyticsTool = {
  name: "internal_get_google_analytics_report", // Usei um prefixo para evitar conflitos
  description:
    "Obtém dados de tráfego (utilizadores e páginas) do Google Analytics GA4.",
  parameters: {
    type: "object",
    properties: {
      days: { type: "number", description: "Período em dias (ex: 7 ou 30)" },
      limit: { type: "number", description: "Número máximo de resultados" },
    },
  },
};

const googleRealtimeTool = {
  name: "internal_get_realtime_traffic",
  description:
    "Obtém os utilizadores ativos no site AGORA (últimos 30 minutos). Usa esta ferramenta quando o utilizador perguntar por dados 'em tempo real', 'agora' ou 'neste momento'.",
  parameters: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Máximo de resultados (ex: 10)" },
    },
  },
};

app.get("/tools", async (c) => {
  try {
    const tools = await getAvailableTools();
    return c.json({ success: true, tools });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.post("/execute-tool", async (c) => {
  try {
    const { server, tool, args } = await c.req.json();
    const mcpManager = await getMcpManagerInstance();
    const result = await mcpManager.callTool(server, tool, args);
    return c.json({ success: true, result });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.post("/chat", async (c) => {
  try {
    const { message } = await c.req.json();

    // ✅ ADICIONA O AWAIT AQUI
    // Como createMarketingOS() é async, precisas de esperar pela compilação
    const os = await createMarketingOS();

    console.log("🚀 Iniciando processamento do Grafo...");

    const finalState = await os.invoke({
      messages: [{ role: "user", content: message }],
    });

    // Procura a última mensagem de texto do assistente (ignorando tool resultados brutos)
    const assistantMessages = finalState.messages.filter(
      (m) => (m.role === "assistant" || m.type === "assistant") && m.content,
    );
    const lastReply = assistantMessages[assistantMessages.length - 1]?.content;

    return c.json({
      reply: lastReply || "Ocorreu um erro no processamento.",
      context: finalState.currentProfile,
    });
  } catch (error: any) {
    console.error("❌ Erro na rota /chat:", error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
