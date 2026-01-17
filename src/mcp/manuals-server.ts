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
import { IndexadorNumerico } from '../../evaluation/indexar-dados-numericos.js';
import { GeminiEmbeddingService } from '../../evaluation/gemini-embedding-service.js';

class ManualsMCPServer {
  private server: Server;
  private indexer: FinalIndexer;
  private searchIndex: any = null;
  private indexadorNumerico: IndexadorNumerico;
  private dadosNumericos: any[] = [];
  private isInitialized: boolean = false;
  private lastCallId: string = '';
  private callCount: number = 0;
  private geminiService: GeminiEmbeddingService;

  constructor() {
    this.server = new Server(
      {
        name: 'manuals-server',
        version: '3.0.0', // Versão atualizada com Gemini Embeddings
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.indexer = new FinalIndexer();
    this.indexadorNumerico = new IndexadorNumerico();
    this.geminiService = new GeminiEmbeddingService();
    this.setupToolHandlers();
  }

  private async initializeIndex() {
    if (this.isInitialized) return;

    try {
      console.log('📂 Carregando índice de manuais COM DADOS NUMÉRICOS...');
      
      // Carregar índice numérico primeiro
      try {
        const fs = await import('fs');
        if (fs.existsSync('./indice-numerico.json')) {
          const indiceNumerico = JSON.parse(fs.readFileSync('./indice-numerico.json', 'utf8'));
          this.dadosNumericos = indiceNumerico.dados;
          console.log(`✅ Índice numérico carregado: ${this.dadosNumericos.length} dados`);
        } else {
          console.log('🔄 Construindo índice numérico...');
          await this.indexadorNumerico.indexarDadosNumericos();
          const fs = await import('fs');
          const indiceNumerico = JSON.parse(fs.readFileSync('./indice-numerico.json', 'utf8'));
          this.dadosNumericos = indiceNumerico.dados;
        }
      } catch (error) {
        console.log('⚠️ Erro ao carregar índice numérico, usando sistema antigo...');
      }
      
      // Carregar índice tradicional como fallback
      this.searchIndex = await this.indexer.loadIndex();
      
      if (!this.searchIndex) {
        console.log('🔄 Construindo índice tradicional...');
        const extractor = new SimpleExtractor();
        const documents = await extractor.processAllPdfs();
        this.searchIndex = this.indexer.buildSearchIndex(documents);
        await this.indexer.saveIndex(this.searchIndex);
      }
      
      this.isInitialized = true;
      console.log(`✅ Sistema inicializado: ${this.dadosNumericos.length} dados numéricos + índice tradicional`);
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
    const { query, model, type = 'all', _clearContext, _callId, _timestamp } = args;

    // Incrementar contador de chamadas
    this.callCount++;
    
    // Verificar se é uma nova chamada (diferente ID ou limpeza forçada)
    const isNewCall = _callId && _callId !== this.lastCallId;
    const shouldClearContext = _clearContext === true || isNewCall || this.callCount === 1;
    
    if (shouldClearContext) {
      console.log(`🧹 Limpando contexto - Call ID: ${_callId}, Nova chamada: ${isNewCall}`);
      this.lastCallId = _callId || '';
    }

    // PRIORIDADE 1: Buscar nos dados numéricos primeiro
    let resultadosNumericos = this.buscarDadosNumericos(query, model);
    
    // PRIORIDADE 2: Se não encontrar em dados numéricos, buscar no índice tradicional
    let resultsTradicionais = this.indexer.search(query, this.searchIndex);
    
    // Combinar resultados
    let allResults = [
      ...resultadosNumericos.map(r => ({
        model: r.modelo,
        section: r.especificacao,
        type: 'specifications',
        content: `${r.especificacao}: ${r.valor} ${r.unidade} (Página ${r.pagina})\nContexto: ${r.contexto.substring(0, 200)}...`,
        callId: _callId,
        timestamp: _timestamp
      })),
      ...resultsTradicionais
    ];

    // Filtrar por modelo se especificado
    if (model) {
      allResults = allResults.filter(result => 
        result.model.toLowerCase().includes(model.toLowerCase())
      );
    }

    // Filtrar por tipo se especificado
    if (type !== 'all') {
      allResults = allResults.filter(result => result.type === type);
    }

    // Limitar resultados
    allResults = allResults.slice(0, 10);

    if (allResults.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Não foram encontradas informações relevantes nos manuais para esta consulta. (Call ID: ${_callId})`,
          },
        ],
      };
    }

    // Priorizar resultados numéricos
    const formattedResults = allResults.map((result, index) => {
      const isNumerico = resultadosNumericos.some(r => 
        r.modelo === result.model && r.especificacao === result.section
      );
      
      const prefix = isNumerico ? '🔢' : '📄';
      const tipoIcon = result.type === 'specifications' ? '📋 Especificações' : '🚀 Funcionalidades';
      
      return `${prefix} **Resultado ${index + 1}**\n` +
        `Modelo: ${result.model}\n` +
        `Seção: ${result.section}\n` +
        `Tipo: ${tipoIcon}\n` +
        `Conteúdo: ${result.content.substring(0, 500)}${result.content.length > 500 ? '...' : ''}\n` +
        `(Call ID: ${_callId || 'N/A'})\n`;
    }).join('\n---\n');

    return {
      content: [
        {
          type: 'text',
          text: `Encontrados ${allResults.length} resultados (Call ID: ${_callId || 'N/A'}):\n\n${formattedResults}`,
        },
      ],
    };
  }

  private buscarDadosNumericos(query: string, model?: string): any[] {
    if (!this.dadosNumericos || this.dadosNumericos.length === 0) {
      return [];
    }

    const queryLower = query.toLowerCase();
    let resultados = this.dadosNumericos;

    // Filtrar por modelo se especificado - MELHORADO
    if (model) {
      resultados = resultados.filter(dado => {
        const modeloLower = dado.modelo.toLowerCase();
        const modelLower = model.toLowerCase();
        
        // Busca flexível por modelo
        return modeloLower.includes(modelLower) || 
               modelLower.includes(modeloLower) ||
               // Variações comuns
               (modelLower.includes('pcx') && modeloLower.includes('pcx')) ||
               (modelLower.includes('forza') && modeloLower.includes('forza')) ||
               (modelLower.includes('sh') && modeloLower.includes('sh')) ||
               (modelLower.includes('vision') && modeloLower.includes('vision')) ||
               (modelLower.includes('cbr') && modeloLower.includes('cbr'));
      });
    }

    // Buscar por termos relevantes - MELHORADO
    const termosRelevantes = [
      'pressao', 'pressão', 'pneu', 'calibragem', 'inflacao', 'inflação',
      'kpa', 'psi', 'bar', 'kgf/cm',
      'folga', 'jogo', 'regulagem', 'acelerador', 'punho', 'flange',
      'torque', 'binario', 'binário', 'aperto', 'parafuso', 'cabeçote',
      'capacidade', 'tanque', 'deposito', 'litro', 'litros'
    ];

    const temTermoRelevante = termosRelevantes.some(termo => 
      queryLower.includes(termo) || termo.includes(queryLower)
    );

    if (temTermoRelevante) {
      // Busca mais abrangente para termos técnicos
      resultados = resultados.filter(dado => {
        const contextoLower = dado.contexto.toLowerCase();
        const especificacaoLower = dado.especificacao.toLowerCase();
        const modeloLower = dado.modelo.toLowerCase();
        
        // Busca mais flexível
        return contextoLower.includes(queryLower) || 
               especificacaoLower.includes(queryLower) ||
               (queryLower.includes('pressao') && (
                 contextoLower.includes('pneu') || 
                 contextoLower.includes('traseiro') ||
                 contextoLower.includes('dianteiro') ||
                 especificacaoLower.includes('pressão')
               )) ||
               (queryLower.includes('folga') && (
                 contextoLower.includes('acelerador') || 
                 contextoLower.includes('punho') ||
                 contextoLower.includes('flange')
               )) ||
               (queryLower.includes('capacidade') && (
                 contextoLower.includes('tanque') || 
                 contextoLower.includes('deposito') ||
                 especificacaoLower.includes('capacidade')
               ));
      });
    }

    return resultados;
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
