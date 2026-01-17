import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ErrorCode, 
  ListToolsRequestSchema,
  McpError 
} from '@modelcontextprotocol/sdk/types.js';
import { VectorSearchMCPIntegration } from './vector-search-integration.js';

class VectorSearchMCPServer {
  private server: Server;
  private vectorIntegration: VectorSearchMCPIntegration;
  private isInitialized: boolean = false;

  constructor() {
    this.server = new Server(
      {
        name: 'manuals-vector-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.vectorIntegration = new VectorSearchMCPIntegration();
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'vector_search',
            description: 'Busca vetorial semântica nos manuais Honda',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Query para busca vetorial'
                },
                model: {
                  type: 'string',
                  description: 'Modelo específico (opcional)'
                },
                type: {
                  type: 'string',
                  description: 'Tipo de dados (opcional)',
                  enum: ['all', 'specifications', 'features']
                },
                limit: {
                  type: 'number',
                  description: 'Limite de resultados',
                  default: 10
                },
                useVector: {
                  type: 'boolean',
                  description: 'Usar busca vetorial',
                  default: true
                },
                useTextual: {
                  type: 'boolean',
                  description: 'Usar busca textual como fallback',
                  default: true
                }
              },
              required: ['query']
            }
          },
          {
            name: 'get_vector_stats',
            description: 'Estatísticas do índice vetorial',
            inputSchema: {
              type: 'object',
              properties: {},
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'vector_search':
            return await this.handleVectorSearch(args);
          case 'get_vector_stats':
            return await this.handleGetVectorStats(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Tool desconhecido: ${name}`
            );
        }
      } catch (error) {
        console.error(`❌ Erro na tool ${name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Erro ao executar ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async handleVectorSearch(args: any) {
    await this.ensureInitialized();
    
    const response = await this.vectorIntegration.search(args.query, {
      model: args.model,
      type: args.type,
      limit: args.limit || 10,
      useVector: args.useVector !== false,
      useTextual: args.useTextual !== false
    });
    
    return response;
  }

  private async handleGetVectorStats(args: any) {
    await this.ensureInitialized();
    
    const stats = this.vectorIntegration.getSearchStats();
    
    return {
      content: [
        {
          type: 'text',
          text: `📊 Estatísticas do Índice Vectorial:\n\n` +
            `📋 Documentos Indexados: ${stats.totalDocuments}\n` +
            `🧠 Dimensão do Embedding: ${stats.embeddingDimension}\n` +
            `📏 Tamanho Médio: ${stats.averageDocumentLength.toFixed(2)} caracteres\n` +
            `💾 Tamanho do Índice: ${(stats.indexSize / 1024 / 1024).toFixed(2)} MB\n\n` +
            `✅ Vector Search pronto para uso!`
        }
      ]
    };
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      console.log('🔄 Inicializando Vector Search MCP Server...');
      await this.vectorIntegration.initialize();
      this.isInitialized = true;
      console.log('✅ Vector Search MCP Server inicializado');
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('🚀 Vector Search MCP Server rodando na porta stdio');
  }

  async stop() {
    await this.server.close();
    console.log('🔌 Vector Search MCP Server finalizado');
  }
}

// Executar servidor
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new VectorSearchMCPServer();
  
  server.run().catch(error => {
    console.error('❌ Erro ao iniciar Vector Search MCP Server:', error);
    process.exit(1);
  });
}

export { VectorSearchMCPServer };
