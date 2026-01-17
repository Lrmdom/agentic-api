import { z } from "genkit";
import { ai, ga4RealtimeTool, manualSearchTool, catalogSearchTool } from "./genkit-tools.js";

// System prompt otimizado para eficiência de custos (menos de 50 tokens)
const OPTIMIZED_SYSTEM_PROMPT = `Assistente Honda Portugal. Usa ferramentas apenas para perguntas relevantes. Responde de forma concisa.`;

// Função para determinar ativação de ferramentas
function shouldActivateTool(query: string): { tool: string | null, reason: string } {
  const lowerQuery = query.toLowerCase();
  
  // Keywords para ferramentas específicas
  const manualKeywords = ["pressão", "pneus", "ajuste", "especificações", "manual", "técnico", "folga", "torque"];
  const catalogKeywords = ["preço", "stock", "cor", "venda", "catálogo", "disponível", "comprar"];
  const analyticsKeywords = ["estatísticas", "utilizadores", "métricas", "relatório", "ativos"];
  
  if (manualKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return { tool: "manualSearch", reason: "Technical manual query" };
  } else if (catalogKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return { tool: "catalogSearch", reason: "Sales catalog query" };
  } else if (analyticsKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return { tool: "analytics", reason: "Analytics query" };
  }
  
  return { tool: null, reason: "General conversation" };
}

export const marketingFlow = ai.defineFlow(
  {
    name: "askHondaOptimized",
    inputSchema: z.string(),
  },
  async (userInput) => {
    // Análise da query para determinar uso de ferramentas
    const toolDecision = shouldActivateTool(userInput);
    console.log(`🔍 Tool decision: ${toolDecision.reason} -> ${toolDecision.tool || 'none'}`);
    
    // Seleção de ferramentas baseada na relevância
    const tools: any[] = [];
    if (toolDecision.tool === "manualSearch") {
      tools.push(manualSearchTool);
    } else if (toolDecision.tool === "catalogSearch") {
      tools.push(catalogSearchTool);
    } else if (toolDecision.tool === "analytics") {
      tools.push(ga4RealtimeTool);
    }
    
    // Geração de resposta com ou sem ferramentas
    const response = await ai.generate({
      model: "googleai/gemini-2.0-flash",
      prompt: `${OPTIMIZED_SYSTEM_PROMPT}\n\nUtilizador: ${userInput}`,
      tools: tools,
      config: {
        temperature: 0.3,
        maxOutputTokens: 500, // Limitado para economizar tokens
      }
    });
    
    return { 
      reply: response.text,
      toolUsed: toolDecision.tool,
      costOptimized: true
    };
  },
);
