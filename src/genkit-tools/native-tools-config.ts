// src/genkit-tools/native-tools-config.ts
import { supabaseTools } from './supabase-tools-native.js';
// import { analyticsTools } from './analytics-tools-native.js'; // Importação dinâmica para evitar carregamento em produção

// Verifica se estamos em produção
const isProduction = process.env.NODE_ENV === 'production' || process.env.K_SERVICE || process.env.K_REVISION;

// Ferramentas nativas leves para produção
export const nativeTools = {
  // Supabase tools
  supabase_query: {
    name: 'supabase_query',
    description: 'Executa consultas SQL no Supabase',
    handler: supabaseTools.supabaseQuery,
    inputSchema: {
      table: { type: 'string', description: 'Nome da tabela para consultar' },
      select: { type: 'string', description: 'Colunas a selecionar (padrão: *)' },
      filter: { type: 'string', description: 'Filtro WHERE em formato SQL' },
      limit: { type: 'number', description: 'Limite de registros (padrão: 100)' },
    },
  },
  
  supabase_insert: {
    name: 'supabase_insert',
    description: 'Insere dados em uma tabela do Supabase',
    handler: supabaseTools.supabaseInsert,
    inputSchema: {
      table: { type: 'string', description: 'Nome da tabela para inserir dados' },
      data: { type: 'any', description: 'Dados a inserir (objeto ou array)' },
    },
  },
  
  supabase_update: {
    name: 'supabase_update',
    description: 'Atualiza dados em uma tabela do Supabase',
    handler: supabaseTools.supabaseUpdate,
    inputSchema: {
      table: { type: 'string', description: 'Nome da tabela para atualizar' },
      data: { type: 'any', description: 'Dados a atualizar' },
      filter: { type: 'string', description: 'Filtro WHERE para identificar registros' },
    },
  },
  
  supabase_rpc: {
    name: 'supabase_rpc',
    description: 'Executa funções RPC no Supabase',
    handler: supabaseTools.supabaseRPC,
    inputSchema: {
      functionName: { type: 'string', description: 'Nome da função RPC' },
      params: { type: 'any', description: 'Parâmetros da função' },
    },
  },
  
  // Analytics tools (carregado dinamicamente)
  analytics_realtime: {
    name: 'analytics_realtime',
    description: 'Obtém relatório em tempo real do Google Analytics',
    handler: async (input: any) => {
      const { analyticsTools } = await import('./analytics-tools-native.js');
      return await analyticsTools.analyticsRealtime(input);
    },
    inputSchema: {
      limit: { type: 'number', description: 'Limite de registros (padrão: 10)' },
    },
  },
  
  analytics_report: {
    name: 'analytics_report',
    description: 'Obtém relatório histórico do Google Analytics',
    handler: async (input: any) => {
      const { analyticsTools } = await import('./analytics-tools-native.js');
      return await analyticsTools.analyticsReport(input);
    },
    inputSchema: {
      days: { type: 'number', description: 'Número de dias (padrão: 7)' },
      limit: { type: 'number', description: 'Limite de registros (padrão: 5)' },
    },
  },
  
  analytics_custom_metrics: {
    name: 'analytics_custom_metrics',
    description: 'Obtém métricas personalizadas do Google Analytics',
    handler: async (input: any) => {
      const { analyticsTools } = await import('./analytics-tools-native.js');
      return await analyticsTools.analyticsCustomMetrics(input);
    },
    inputSchema: {
      dimensions: { type: 'array', description: 'Array de dimensões' },
      metrics: { type: 'array', description: 'Array de métricas' },
      startDate: { type: 'string', description: 'Data inicial (padrão: 7daysAgo)' },
      endDate: { type: 'string', description: 'Data final (padrão: today)' },
      limit: { type: 'number', description: 'Limite de registros (padrão: 10)' },
    },
  },
};

// Função para obter ferramentas baseadas no ambiente
export function getAvailableTools() {
  if (isProduction) {
    console.log("🚀 Usando ferramentas nativas em produção (otimização de memória)");
    return nativeTools;
  } else {
    console.log("💻 Usando MCP servers em desenvolvimento");
    return {}; // Em dev, usa MCP servers
  }
}

// Função para executar uma ferramenta nativa
export async function executeNativeTool(toolName: string, input: any) {
  const tool = nativeTools[toolName as keyof typeof nativeTools];
  
  if (!tool) {
    throw new Error(`Ferramenta não encontrada: ${toolName}`);
  }
  
  try {
    const result = await tool.handler(input);
    return {
      success: true,
      result,
      toolName,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      toolName,
    };
  }
}

// Exportar nomes das ferramentas para referência
export const nativeToolNames = Object.keys(nativeTools);
console.log(`📋 Ferramentas nativas disponíveis: ${nativeToolNames.join(', ')}`);
