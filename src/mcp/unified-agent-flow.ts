import { z } from "genkit";
import { ai, enhancedCatalogTool, enhancedManualsTool, analyticsTool } from "./unified-agent-tools.js";

// System prompt otimizado para Single Point of Truth
const UNIFIED_SYSTEM_PROMPT = `Assistente Honda Portugal. Usa ferramentas apenas para perguntas relevantes. Responde de forma concisa.`;

// Função inteligente para decidir qual ferramenta usar (com otimização BigQuery)
function shouldActivateTool(query: string): { tool: string | null, checkStock: boolean, reason: string } {
  const lowerQuery = query.toLowerCase();
  
  // Keywords para ferramentas específicas
  const manualKeywords = ["pressão", "pneus", "ajuste", "especificações", "manual", "técnico", "folga", "torque", "óleo", "capacidade", "manutenção"];
  const catalogKeywords = ["preço", "stock", "cor", "venda", "catálogo", "disponível", "comprar", "unidades", "modelo", "moto"];
  const analyticsKeywords = ["estatísticas", "utilizadores", "métricas", "relatório", "ativos", "visitantes", "tráfego"];
  
  // Keywords que exigem BigQuery (stock em tempo real)
  const stockKeywords = ["stock", "disponível", "unidades", "quantas", "tem", "existe"];
  
  // Verificar se precisa de stock em tempo real
  const needsStock = stockKeywords.some(keyword => lowerQuery.includes(keyword));
  
  if (manualKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return { tool: "manuals", checkStock: false, reason: "Technical manual query" };
  } else if (catalogKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return { tool: "catalog", checkStock: needsStock, reason: `Catalog query${needsStock ? ' with stock check' : ''}` };
  } else if (analyticsKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return { tool: "analytics", checkStock: false, reason: "Analytics query" };
  }
  
  return { tool: null, checkStock: false, reason: "General conversation" };
}

// AgentFlow unificado - Single Point of Truth
export const unifiedAgentFlow = ai.defineFlow(
  {
    name: "hondaUnifiedAgent",
    inputSchema: z.string(),
  },
  async (userInput) => {
    console.log(`🚀 Unified Agent: "${userInput}"`);
    
    // Análise inteligente da query
    const toolDecision = shouldActivateTool(userInput);
    console.log(`🔍 Tool decision: ${toolDecision.reason} -> ${toolDecision.tool || 'none'}${toolDecision.checkStock ? ' (with BigQuery)' : ''}`);
    
    // Seleção otimizada de ferramentas
    const tools: any[] = [];
    let toolParams: any = {};
    
    if (toolDecision.tool === "manuals") {
      tools.push(enhancedManualsTool);
      toolParams = { query: userInput, maxResults: 3 };
    } else if (toolDecision.tool === "catalog") {
      tools.push(enhancedCatalogTool);
      toolParams = { 
        query: userInput, 
        checkStock: toolDecision.checkStock,
        maxResults: 5 
      };
      console.log(`📊 BigQuery access: ${toolDecision.checkStock ? 'YES' : 'NO (token saving)'}`);
    } else if (toolDecision.tool === "analytics") {
      tools.push(analyticsTool);
      toolParams = { metric: "active_users", period: "today" };
    }
    
    // Geração de resposta otimizada
    const response = await ai.generate({
      model: "googleai/gemini-2.0-flash",
      prompt: `${UNIFIED_SYSTEM_PROMPT}\n\nUtilizador: ${userInput}`,
      tools: tools,
      config: {
        temperature: 0.3,
        maxOutputTokens: 300, // Reduzido para economizar tokens
      }
    });
    
    // Metadata para tracking
    const metadata = {
      toolUsed: toolDecision.tool,
      bigQueryAccess: toolDecision.checkStock,
      costOptimized: true,
      tokenEstimate: response.text.length + 47, // system prompt + response
      source: toolDecision.tool || 'direct_response'
    };
    
    console.log(`✅ Response generated | Tool: ${toolDecision.tool || 'none'} | BigQuery: ${toolDecision.checkStock ? 'YES' : 'NO'}`);
    
    return {
      reply: response.text,
      metadata,
      unified: true
    };
  },
);

// Flow alternativo para debugging e testes
export const debugUnifiedFlow = ai.defineFlow(
  {
    name: "hondaDebugAgent",
    inputSchema: z.object({
      query: z.string(),
      forceTool: z.string().optional().describe('Force specific tool: catalog, manuals, analytics, none'),
      forceStockCheck: z.boolean().optional().describe('Force BigQuery stock check')
    }),
  },
  async ({ query, forceTool, forceStockCheck }) => {
    console.log(`🐛 Debug Mode: "${query}" | Force: ${forceTool || 'auto'} | Stock: ${forceStockCheck || 'auto'}`);
    
    // Usar tool forçada ou decisão automática
    let toolDecision;
    if (forceTool) {
      toolDecision = {
        tool: forceTool === 'none' ? null : forceTool,
        checkStock: forceStockCheck || false,
        reason: `Forced: ${forceTool}`
      };
    } else {
      toolDecision = shouldActivateTool(query);
    }
    
    const tools: any[] = [];
    let toolParams: any = {};
    
    if (toolDecision.tool === "manuals") {
      tools.push(enhancedManualsTool);
      toolParams = { query, maxResults: 3 };
    } else if (toolDecision.tool === "catalog") {
      tools.push(enhancedCatalogTool);
      toolParams = { 
        query, 
        checkStock: toolDecision.checkStock,
        maxResults: 5 
      };
    } else if (toolDecision.tool === "analytics") {
      tools.push(analyticsTool);
      toolParams = { metric: "active_users", period: "today" };
    }
    
    const response = await ai.generate({
      model: "googleai/gemini-2.0-flash",
      prompt: `${UNIFIED_SYSTEM_PROMPT}\n\nUtilizador: ${query}`,
      tools: tools,
      config: {
        temperature: 0.3,
        maxOutputTokens: 300,
      }
    });
    
    return {
      reply: response.text,
      debug: {
        originalQuery: query,
        toolDecision,
        toolParams,
        bigQueryAccess: toolDecision.checkStock
      },
      unified: true
    };
  },
);
