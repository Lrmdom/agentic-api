import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

export class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private callHistory: Map<string, any[]> = new Map();
  private maxHistorySize = 5; // Limitar histórico

  async initializeServer(
    name: string,
    config: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    },
  ) {
    // Spawn MCP server como child process

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      // @ts-ignore
      env: {
        ...process.env,
        ...config.env,
        MCP_NO_HISTORY: 'true', // Desativar histórico no servidor
        MCP_CLEAN_CONTEXT: 'true', // Forçar limpeza de contexto
      },
    });

    const client = new Client(
      {
        name: `mcp-client-${name}`,
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    await client.connect(transport);
    this.clients.set(name, client);
    this.callHistory.set(name, []); // Inicializar histórico

    console.log(`✅ MCP server "${name}" inicializado com controle de contexto`);

    return client;
  }

  getClient(name: string): Client | undefined {
    return this.clients.get(name);
  }

  async listTools(serverName: string) {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`Server ${serverName} não encontrado`);

    const response = await client.listTools();
    return response.tools;
  }

  async callTool(serverName: string, toolName: string, args: any) {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`Server ${serverName} não encontrado`);

    // Adicionar timestamp e ID único para evitar cache
    const callId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const cleanArgs = {
      ...args,
      _callId: callId,
      _timestamp: Date.now(),
      _clearContext: true, // Forçar limpeza de contexto
    };

    // Registrar chamada no histórico
    const history = this.callHistory.get(serverName) || [];
    history.push({
      callId,
      toolName,
      args: cleanArgs,
      timestamp: Date.now()
    });

    // Manter apenas as últimas chamadas no histórico
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
    this.callHistory.set(serverName, history);

    console.log(`🔄 Chamando ${toolName} com contexto limpo (ID: ${callId})`);

    const response = await client.callTool({
      name: toolName,
      arguments: cleanArgs,
    });

    return response;
  }

  // Método para limpar contexto explicitamente
  async clearContext(serverName?: string) {
    if (serverName) {
      this.callHistory.set(serverName, []);
      console.log(`🧹 Contexto limpo para servidor: ${serverName}`);
    } else {
      this.callHistory.clear();
      console.log(`🧹 Contexto limpo para todos os servidores`);
    }
  }

  // Método para obter estatísticas de uso
  getContextStats(serverName?: string) {
    if (serverName) {
      const history = this.callHistory.get(serverName) || [];
      return {
        server: serverName,
        totalCalls: history.length,
        lastCall: history.length > 0 ? history[history.length - 1].timestamp : null
      };
    }

    const stats: Record<string, any> = {};
    for (const [name, history] of this.callHistory.entries()) {
      stats[name] = {
        totalCalls: history.length,
        lastCall: history.length > 0 ? history[history.length - 1].timestamp : null
      };
    }
    return stats;
  }

  async cleanup() {
    // Limpar contexto antes de desconectar
    await this.clearContext();
    
    for (const [name, client] of this.clients) {
      await client.close();
      console.log(`🔌 MCP server "${name}" desconectado`);
    }
    this.clients.clear();
    this.callHistory.clear();
  }
}

// Singleton instance
export const mcpManager = new MCPClientManager();
