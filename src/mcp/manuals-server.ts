import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ErrorCode, 
  ListToolsRequestSchema,
  McpError 
} from '@modelcontextprotocol/sdk/types.js';
import { FinalIndexer } from '../final-indexer.js';
import { SimpleExtractor } from '../simple-extractor.js';

class ManualsMCPServer {
  private server: Server;
  private indexer: FinalIndexer;
  private searchIndex: any = null;
  private isInitialized: boolean = false;

  constructor() {
    this.server = new Server(
      {
        name: 'manuals-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.indexer = new FinalIndexer();
    this.setupToolHandlers();
  }

  private async initializeIndex() {
    if (this.isInitialized) return;

    try {
      console.log('📂 Carregando índice de manuais...');
      this.searchIndex = await this.indexer.loadIndex();
      
      if (!this.searchIndex) {
        console.log('🔄 Construindo novo índice...');
        const extractor = new SimpleExtractor();
        const documents = await extractor.processAllPdfs();
        this.searchIndex = this.indexer.buildSearchIndex(documents);
        await this.indexer.saveIndex(this.searchIndex);
      }
      
      this.isInitialized = true;
      console.log(`✅ Índice carregado: ${this.searchIndex.documents.length} documentos`);
    } catch (error) {
      console.error('❌ Erro ao inicializar índice:', error);
      throw error;
    }
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_manuals',
            description: 'Procura informações técnicas nos manuais de motos Honda (especificações, funcionalidades, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'A pergunta ou termo de busca sobre especificações técnicas, funcionalidades ou características das motos',
                },
                model: {
                  type: 'string',
                  description: 'Modelo específico para buscar (ex: "forza 125", "sh 125", "pcx 125")',
                },
                type: {
                  type: 'string',
                  enum: ['specifications', 'features', 'all'],
                  description: 'Tipo de conteúdo: specifications (especificações), features (funcionalidades), all (ambos)',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_model_info',
            description: 'Obtém informações completas de um modelo específico de moto',
            inputSchema: {
              type: 'object',
              properties: {
                model: {
                  type: 'string',
                  description: 'Modelo da moto (ex: "forza 125", "sh 125", "pcx 125", "vision 110")',
                },
              },
              required: ['model'],
            },
          },
          {
            name: 'list_available_models',
            description: 'Lista todos os modelos de motos disponíveis nos manuais',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.initializeIndex();

      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_manuals':
            return await this.handleSearchManuals(args);
          case 'get_model_info':
            return await this.handleGetModelInfo(args);
          case 'list_available_models':
            return await this.handleListModels();
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

  private async handleSearchManuals(args: any) {
    const { query, model, type = 'all' } = args;

    let results = this.indexer.search(query, this.searchIndex);

    // Filtrar por modelo se especificado
    if (model) {
      results = results.filter(result => 
        result.model.toLowerCase().includes(model.toLowerCase())
      );
    }

    // Filtrar por tipo se especificado
    if (type !== 'all') {
      results = results.filter(result => result.type === type);
    }

    // Limitar resultados
    results = results.slice(0, 5);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'Não foram encontradas informações relevantes nos manuais para esta consulta.',
          },
        ],
      };
    }

    const formattedResults = results.map((result, index) => 
      `**Resultado ${index + 1}**\n` +
      `Modelo: ${result.model}\n` +
      `Seção: ${result.section}\n` +
      `Tipo: ${result.type === 'specifications' ? '📋 Especificações' : '🚀 Funcionalidades'}\n` +
      `Conteúdo: ${result.content.substring(0, 500)}${result.content.length > 500 ? '...' : ''}\n`
    ).join('\n---\n');

    return {
      content: [
        {
          type: 'text',
          text: `Encontrados ${results.length} resultados:\n\n${formattedResults}`,
        },
      ],
    };
  }

  private async handleGetModelInfo(args: any) {
    const { model } = args;

    const results = this.indexer.getModelInfo(model, this.searchIndex);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Modelo "${model}" não encontrado nos manuais disponíveis.`,
          },
        ],
      };
    }

    const specs = results.filter(r => r.type === 'specifications');
    const features = results.filter(r => r.type === 'features');

    let response = `**Informações completas: ${model}**\n\n`;

    if (specs.length > 0) {
      response += `📋 **ESPECIFICAÇÕES TÉCNICAS**\n\n`;
      specs.forEach((spec, index) => {
        response += `${spec.content}\n\n`;
      });
    }

    if (features.length > 0) {
      response += `🚀 **FUNCIONALIDADES E EQUIPAMENTO**\n\n`;
      features.forEach((feature, index) => {
        response += `${feature.content}\n\n`;
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  }

  private async handleListModels() {
    const models = [...new Set(this.searchIndex.documents.map((d: any) => d.model))];

    const response = `**Modelos disponíveis nos manuais:**\n\n` +
      models.map((model, index) => `${index + 1}. ${model}`).join('\n') +
      `\n\nTotal: ${models.length} modelos`;

    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('📚 Manuals MCP Server running on stdio');
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ManualsMCPServer();
  server.run().catch(console.error);
}

export { ManualsMCPServer };
