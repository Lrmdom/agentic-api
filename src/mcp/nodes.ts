import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getMcpManagerInstance } from "./servers.js";
import { tool } from "@langchain/core/tools";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { z } from "zod";
import fs from "fs";

// ✅ CORREÇÃO: Usar 'model' e garantir que as chaves estão certas
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-exp",
  apiKey: process.env.GEMINI_API_KEY,
});

// Configuração do Analytics Client para produção/desenvolvimento
const getClientConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.K_SERVICE || process.env.K_REVISION;
  
  if (isProduction) {
    console.log("☁️ Produção: Usando Workload Identity para Analytics.");
    return {};
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS };
  }

  const localKeyPath = "./avid-infinity-370500-d9f7e84d26a4.json";
  if (fs.existsSync(localKeyPath)) {
    console.log("💻 Dev: Ficheiro Analytics encontrado. Usando chave local.");
    return { keyFilename: localKeyPath };
  }

  console.log("⚠️ Nenhuma credencial Analytics encontrada. Usando Workload Identity.");
  return {};
};

const analyticsClient = new BetaAnalyticsDataClient(getClientConfig());

// ✅ TOOL GA4
export const ga4RealtimeTool = tool(
  async ({ limit }) => {
    console.log("📊 [GA4] Executando via SDK...");
    try {
      const [response] = await analyticsClient.runRealtimeReport({
        property: `properties/511766107`,
        dimensions: [{ name: "customUser:user_name" }, { name: "city" }],
        metrics: [{ name: "activeUsers" }],
        limit: limit || 10,
      });
      if (!response.rows) return "Ninguém online agora.";
      return JSON.stringify(
        response.rows.map((row) => ({
          nome: row.dimensionValues?.[0]?.value,
          cidade: row.dimensionValues?.[1]?.value,
        })),
      );
    } catch (e: any) {
      return `Erro no GA4: ${e.message}`;
    }
  },
  {
    name: "get_ga4_realtime_users",
    description: "Obtém utilizadores online no GA4 agora.",
    schema: z.object({ limit: z.number().optional() }),
  },
);

// ✅ EXPORTAÇÃO DOS NÓS
export async function agentNode(state: any) {
  console.log("--- Nível 0: Agente ---");
  const allTools = [ga4RealtimeTool];
  const modelWithTools = model.bindTools(allTools);

  const response = await modelWithTools.invoke([
    {
      role: "system",
      content:
        "És um analista. Se pedirem dados tempo real, usa get_ga4_realtime_users.",
    },
    ...state.messages,
  ]);
  return { messages: [response] };
}

// src/mcp/nodes.ts

export async function identityNode(state: any) {
  console.log("--- Nível 1: Identidade (Supabase) ---");

  // 1. Tenta extrair o ID do utilizador das mensagens do GA4 ou do contexto
  // Aqui assumimos que o Agente ou o GA4 já encontraram um identificador
  const lastMessage = state.messages[state.messages.length - 1];

  // Simulação: procurar um email no histórico ou usar um default para teste
  const userEmail = "lmatiasdomingos@gmail.com";

  try {
    // 2. Chamada ao MCP do Supabase para buscar o perfil real
    const mcpManager = await getMcpManagerInstance();
    const profile = await mcpManager.callTool("supabase", "get_user_by_email", {
      email: userEmail,
    });

    return {
      currentProfile: profile || { email: userEmail, status: "guest" },
    };
  } catch (error) {
    console.error("❌ Erro ao consultar Supabase:", error);
    return {
      currentProfile: { email: userEmail, note: "Erro na base de dados" },
    };
  }
}

// src/mcp/nodes.ts

export async function commerceNode(state: any) {
  console.log("--- Nível 2: Commerce Layer ---");

  const email = state.currentProfile?.email;
  if (!email) return { commerceData: { status: "unknown" } };

  try {
    // 3. Chamada ao teu MCP de Commerce Layer (que configuraste no servers.ts)
    const mcpManager = await getMcpManagerInstance();
    const orders = await mcpManager.callTool(
      "commercelayermetrics",
      "get_customer_orders",
      {
        email: email,
      },
    );

    return {
      commerceData: {
        total_spent: orders.total_amount || 0,
        last_order: orders.latest_date,
        is_returning: (orders as any).count > 0,
      },
    };
  } catch (error) {
    console.warn("⚠️ Commerce Layer offline ou sem dados.");
    return { commerceData: { status: "error" } };
  }
}

export async function executionNode(state: any) {
  console.log("--- Nível 3: Execução ---");
  const lastMsg = [...state.messages]
    .reverse()
    .find((m) => m.content && !m.tool_calls?.length);
  return {
    reply: lastMsg?.content || "Erro ao processar resposta final.",
    context: state.currentProfile,
  };
}
