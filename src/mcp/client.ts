import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

export class MCPClientManager {
  private clients: Map<string, Client> = new Map();

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

    console.log(`✅ MCP server "${name}" inicializado`);

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

    const response = await client.callTool({
      name: toolName,
      arguments: args,
    });

    return response;
  }

  async cleanup() {
    for (const [name, client] of this.clients) {
      await client.close();
      console.log(`🔌 MCP server "${name}" desconectado`);
    }
    this.clients.clear();
  }
}

// Singleton instance
export const mcpManager = new MCPClientManager();
