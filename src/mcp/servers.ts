// src/mcp/servers.ts
import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });
import path from "path";

// 1. Variável interna para cache da instância
let cachedMcpClient: any = null;

/**
 * Obtém a instância real do mcpManager do ficheiro client.js.
 * Garante que retornamos o OBJETO e não a função de importação.
 */
export async function getMcpManagerInstance() {
  if (!cachedMcpClient) {
    const clientModule = await import("./client.js");
    // Extraímos a instância real exportada
    cachedMcpClient = clientModule.mcpManager;
  }
  return cachedMcpClient;
}

// ✅ Configuração dos servidores
const getBrevoServers = () => {
  const isDevMode = !(process.env.NODE_ENV === 'production' || process.env.K_SERVICE || process.env.K_REVISION);
  
  if (!isDevMode) {
    // Em produção, podes optar por carregar apenas o essencial ou nenhum se quiseres poupar RAM
    return [];
  }
  
  return [
    /* {
      name: "brevo_contacts",
      command: "npx",
      args: ["-y", "mcp-remote", `https://mcp.brevo.com/v1/brevo_contacts/mcp/${process.env.BREVO_MCP_KEY}`],
    },
    {
      name: "brevo_deals",
      command: "npx",
      args: ["-y", "mcp-remote", `https://mcp.brevo.com/v1/brevo_deals/mcp/${process.env.BREVO_MCP_KEY}`],
    },
    {
      name: "brevo_campaigns",
      command: "npx",
      args: ["-y", "mcp-remote", `https://mcp.brevo.com/v1/brevo_email_campaign_management/mcp/${process.env.BREVO_MCP_KEY}`],
    },
    {
      name: "brevo_templates",
      command: "npx",
      args: ["-y", "mcp-remote", `https://mcp.brevo.com/v1/brevo_templates/mcp/${process.env.BREVO_MCP_KEY}`],
    },
    {
      name: "brevo_analytics",
      command: "npx",
      args: ["-y", "mcp-remote", `https://mcp.brevo.com/v1/brevo_campaign_analytics/mcp/${process.env.BREVO_MCP_KEY}`],
    },
    {
      name: "brevo_email",
      command: "npx",
      args: ["-y", "mcp-remote", `https://mcp.brevo.com/v1/brevo_email_campaign_management/mcp/${process.env.BREVO_MCP_KEY}`],
    }, */
  ];
};

const SERVER_CONFIGS = [
  {
      name: "brevo_contacts",
      command: "npx",
      args: ["-y", "mcp-remote", `https://mcp.brevo.com/v1/brevo_contacts/mcp/${process.env.BREVO_MCP_KEY}`],
      env: { BREVO_MCP_KEY: process.env.BREVO_MCP_KEY },
    },
  {
    name: "filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
    env: {},
  },
  {
    name: "memory",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    env: {},
  },
  {
    name: "manuals",
    command: "npx",
    args: ["tsx", path.resolve(process.cwd(), "src/mcp/manuals-server.ts")],
    env: {},
  },
  {
    name: "enhanced-catalog",
    command: "npx",
    args: ["tsx", path.resolve(process.cwd(), "src/mcp/enhanced-catalog-server.ts")],
    env: {},
  },
  /* {
    name: "google-maps",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-google-maps"],
    env: { GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY! },
  }, */
  {
    name: "commercelayermetrics",
    command: "node",
    args: [path.resolve("/Users/leoneldomingos/Projects/mcp-server-metrics/dist/server/index.js")],
    env: {
      CL_CLIENT_ID: process.env.CL_INTEGRATION_CLIENT_ID!,
      CL_CLIENT_SECRET: process.env.CL_INTEGRATION_CLIENT_SECRET!,
    },
  },
  //...getBrevoServers(),
];

export function getServerNames(): string[] {
  return SERVER_CONFIGS.map((server) => server.name);
}

/**
 * Inicializa os servidores MCP usando a instância correta do cliente.
 */
export async function initializeMCPServers() {
  console.log(`🚀 Iniciando ${SERVER_CONFIGS.length} MCP server(s)...`);

  // Obtemos a INSTÂNCIA (objeto) e não a função
  const client = await getMcpManagerInstance();

  for (const server of SERVER_CONFIGS) {
    try {
      console.log(`⏳ Inicializando "${server.name}"...`);
      
      // Chamada de método no objeto client
      await client.initializeServer(server.name, {
        command: server.command,
        args: server.args,
        // @ts-ignore
        env: server.env,
      });
      
      console.log(`✅ "${server.name}" inicializado!`);
    } catch (error) {
      console.error(`❌ Erro ao inicializar ${server.name}:`, error);
    }
  }

  console.log("✅ MCP servers prontos!");
}

/**
 * Lista ferramentas disponíveis (MCP + Native fallback)
 */
export async function getAvailableTools() {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.K_SERVICE || process.env.K_REVISION;
  const allTools: Record<string, any[]> = {};
  const serverNames = getServerNames();
  const client = await getMcpManagerInstance();

  console.log(`📋 Buscando tools de ${serverNames.length} server(s)...`);

  for (const serverName of serverNames) {
    try {
      const tools = await client.listTools(serverName);
      allTools[serverName] = tools;
      console.log(`   ✓ ${tools.length} tools em "${serverName}"`);
    } catch (error) {
      console.error(`   ✗ Erro ao listar tools de "${serverName}":`, error);
    }
  }

  if (isProduction) {
    try {
      const { getAvailableTools: getNativeTools } = await import("../genkit-tools/native-tools-config.js");
      const nativeTools = getNativeTools();
      allTools.native = Object.values(nativeTools);
      console.log(`✅ Adicionadas ferramentas nativas como backup`);
    } catch (error) {
      console.error("❌ Erro ao carregar native tools:", error);
    }
  }

  return allTools;
}