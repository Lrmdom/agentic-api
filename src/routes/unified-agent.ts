import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { unifiedAgentFlow, debugUnifiedFlow } from "../mcp/unified-agent-flow.js";

// Schema para requests unificados
const unifiedRequestSchema = z.object({
  query: z.string().min(1, "Query is required"),
  userId: z.string().optional().default("anonymous"),
  debug: z.boolean().optional().default(false),
  forceTool: z.string().optional().describe('Force specific tool: catalog, manuals, analytics, none'),
  forceStockCheck: z.boolean().optional().describe('Force BigQuery stock check')
});

// Schema para respostas
const unifiedResponseSchema = z.object({
  success: z.boolean(),
  reply: z.string(),
  metadata: z.object({
    toolUsed: z.string().nullable(),
    bigQueryAccess: z.boolean(),
    costOptimized: z.boolean(),
    tokenEstimate: z.number(),
    source: z.string(),
    responseTime: z.number()
  }),
  timestamp: z.string()
});

// Router unificado
export const unifiedRouter = new Hono();

// Endpoint principal - Single Point of Truth
unifiedRouter.post("/agent", zValidator("json", unifiedRequestSchema), async (c) => {
  const startTime = Date.now();
  
  try {
    const { query, userId, debug, forceTool, forceStockCheck } = c.req.valid("json");
    
    console.log(`🚀 Unified Agent Request: "${query}" | User: ${userId} | Debug: ${debug}`);
    
    let result;
    
    if (debug) {
      // Modo debug com controle manual
      result = await debugUnifiedFlow({ 
        query, 
        forceTool, 
        forceStockCheck 
      });
    } else {
      // Modo automático otimizado
      result = await unifiedAgentFlow(query);
    }
    
    const responseTime = Date.now() - startTime;
    
    // Metadata enriquecida
    const metadata = {
      ...result.metadata,
      responseTime,
      userId,
      debugMode: debug
    };
    
    console.log(`✅ Unified Response | Tool: ${metadata.toolUsed || 'none'} | BigQuery: ${metadata.bigQueryAccess ? 'YES' : 'NO'} | Time: ${responseTime}ms`);
    
    return c.json({
      success: true,
      reply: result.reply,
      metadata,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("❌ Unified Agent Error:", error);
    
    return c.json({
      success: false,
      error: "Erro ao processar sua solicitação",
      details: process.env.NODE_ENV === "development" ? {
        message: error.message,
        stack: error.stack
      } : undefined,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Endpoint de health check
unifiedRouter.get("/health", async (c) => {
  try {
    // Teste rápido do unified flow
    const testResult = await unifiedAgentFlow("test");
    
    return c.json({
      status: "healthy",
      unifiedAgent: "active",
      timestamp: new Date().toISOString(),
      testResponse: testResult.metadata?.source || "unknown"
    });
  } catch (error: any) {
    return c.json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Endpoint de estatísticas de uso
unifiedRouter.get("/stats", async (c) => {
  // Simular estatísticas (implementar real depois)
  return c.json({
    totalRequests: 1250,
    averageResponseTime: 850,
    bigQueryAccessRate: 0.23, // 23% das queries usam BigQuery
    toolUsage: {
      catalog: 0.45,
      manuals: 0.30,
      analytics: 0.15,
      none: 0.10
    },
    costSavings: {
      tokenReduction: "68%",
      costReduction: "62%",
      bigQueryReduction: "77%"
    },
    timestamp: new Date().toISOString()
  });
});

// Endpoint para testes específicos
unifiedRouter.post("/test", zValidator("json", z.object({
  scenarios: z.array(z.string()).optional()
})), async (c) => {
  const { scenarios } = c.req.valid("json");
  
  const defaultScenarios = [
    "Qual a pressão dos pneus da PCX 125?",
    "Tem Honda Forza 350 em stock?",
    "Quantos utilizadores ativos agora?",
    "Olá, tudo bem?"
  ];
  
  const testScenarios = scenarios || defaultScenarios;
  const results = [];
  
  for (const query of testScenarios) {
    try {
      const startTime = Date.now();
      const result = await unifiedAgentFlow(query);
      const responseTime = Date.now() - startTime;
      
      results.push({
        query,
        success: true,
        reply: result.reply,
        metadata: result.metadata,
        responseTime
      });
    } catch (error: any) {
      results.push({
        query,
        success: false,
        error: error.message
      });
    }
  }
  
  return c.json({
    scenarios: testScenarios,
    results,
    summary: {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      averageTime: results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length
    },
    timestamp: new Date().toISOString()
  });
});
