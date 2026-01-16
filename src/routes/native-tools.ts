// src/routes/native-tools.ts
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
// Import dinâmico para evitar carregamento do Analytics em produção
// import { executeNativeTool, nativeToolNames } from "../genkit-tools/native-tools-config.js";

// Create router
export const nativeToolsRouter = new Hono();

// List available native tools
nativeToolsRouter.get("/list", async (c) => {
  // Importação dinâmica para evitar carregamento em produção
  const { nativeToolNames } = await import("../genkit-tools/native-tools-config.js");
  
  return c.json({
    success: true,
    tools: nativeToolNames,
    environment: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production' || process.env.K_SERVICE || process.env.K_REVISION,
  });
});

// Test endpoint
nativeToolsRouter.get("/test", async (c) => {
  try {
    // Importação dinâmica para evitar carregamento em produção
    const { executeNativeTool } = await import("../genkit-tools/native-tools-config.js");
    
    // Test analytics realtime
    const realtimeResult = await executeNativeTool('analytics_realtime', { limit: 5 });
    
    // Test supabase query (se houver tabela)
    const queryResult = await executeNativeTool('supabase_query', { 
      table: 'test', 
      limit: 1 
    });

    return c.json({
      success: true,
      message: "Native tools test completed",
      results: {
        realtime: realtimeResult,
        query: queryResult,
      },
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

// Execute native tool endpoint
const executeSchema = z.object({
  toolName: z.string().refine(async (val) => {
    const { nativeToolNames } = await import("../genkit-tools/native-tools-config.js");
    return nativeToolNames.includes(val);
  }, {
    message: `Tool must be one of the available native tools`
  }),
  input: z.any().optional(),
});

nativeToolsRouter.post("/execute", zValidator("json", executeSchema), async (c) => {
  try {
    const { toolName, input } = c.req.valid("json");
    
    // Importação dinâmica para evitar carregamento em produção
    const { executeNativeTool } = await import("../genkit-tools/native-tools-config.js");
    const result = await executeNativeTool(toolName, input || {});
    
    return c.json(result);
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

// Health check for native tools
nativeToolsRouter.get("/health", async (c) => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.K_SERVICE || process.env.K_REVISION;
  
  // Importação dinâmica para evitar carregamento em produção
  const { nativeToolNames } = await import("../genkit-tools/native-tools-config.js");
  
  return c.json({
    status: "healthy",
    environment: process.env.NODE_ENV || 'development',
    isProduction,
    availableTools: nativeToolNames.length,
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});
