import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ErrorCode, 
  ListToolsRequestSchema,
  McpError 
} from '@modelcontextprotocol/sdk/types.js';
import { EnhancedCatalogService } from '../enhanced-catalog-service.js';

class EnhancedCatalogMCPServer {
  private server: Server;
  private catalogService: EnhancedCatalogService;

  constructor() {
    this.server = new Server(
      {
        name: 'enhanced-catalog-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.catalogService = new EnhancedCatalogService();
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_enhanced_catalog',
            description: 'Busca veículos no catálogo com verificação de disponibilidade em tempo real usando VECTOR_SEARCH e JOIN com tabela de eventos',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'A busca do cliente (ex: "PCX 125", "moto para cidade", "scooter econômico")',
                },
                data_inicio: {
                  type: 'string',
                  description: 'Data de início pretendida no formato YYYY-MM-DD (opcional)',
                },
                data_fim: {
                  type: 'string', 
                  description: 'Data de fim pretendida no formato YYYY-MM-DD (opcional)',
                },
                top_k: {
                  type: 'number',
                  description: 'Número máximo de resultados (padrão: 5)',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'find_available_alternatives',
            description: 'Encontra alternativas disponíveis quando os veículos solicitados estão reservados no período',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'A busca original do cliente',
                },
                data_inicio: {
                  type: 'string',
                  description: 'Data de início pretendida no formato YYYY-MM-DD',
                },
                data_fim: {
                  type: 'string',
                  description: 'Data de fim pretendida no formato YYYY-MM-DD', 
                },
                top_k: {
                  type: 'number',
                  description: 'Número máximo de alternativas (padrão: 3)',
                },
              },
              required: ['query', 'data_inicio', 'data_fim'],
            },
          },
          {
            name: 'check_vehicle_availability',
            description: 'Verifica disponibilidade de veículos específicos em datas específicas',
            inputSchema: {
              type: 'object',
              properties: {
                vehicle_model: {
                  type: 'string',
                  description: 'Modelo do veículo (ex: "PCX 125", "SH 125")',
                },
                store_location: {
                  type: 'string',
                  description: 'Localização da loja (ex: "Lisboa", "Porto", "Faro")',
                },
                data_inicio: {
                  type: 'string',
                  description: 'Data de início pretendida no formato YYYY-MM-DD',
                },
                data_fim: {
                  type: 'string',
                  description: 'Data de fim pretendida no formato YYYY-MM-DD',
                },
              },
              required: ['vehicle_model', 'data_inicio', 'data_fim'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_enhanced_catalog':
            return await this.handleSearchEnhancedCatalog(args);
          case 'find_available_alternatives':
            return await this.handleFindAlternatives(args);
          case 'check_vehicle_availability':
            return await this.handleCheckAvailability(args);
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

  private async handleSearchEnhancedCatalog(args: any) {
    const { query, data_inicio, data_fim, top_k = 5 } = args;

    console.log(`🔍 Busca no catálogo aprimorado: "${query}"`, { data_inicio, data_fim, top_k });

    try {
      const results = await this.catalogService.searchWithAvailability(
        query, 
        data_inicio, 
        data_fim, 
        top_k
      );

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Não foram encontrados veículos correspondentes à busca "${query}".`,
            },
          ],
        };
      }

      // Formatar resultados
      const formattedResults = results.map((result, index) => {
        let text = `**Resultado ${index + 1}**\n`;
        text += `📋 Modelo: ${result.title || result.vehicleModel}\n`;
        text += `🏪 Localização: ${result.store_location || 'N/A'}\n`;
        text += `💰 Preço: ${result.formatted_total_amount_with_taxes || 'Consultar'}\n`;
        text += `📅 Disponibilidade: ${result.disponibilidade}\n`;
        
        if (result.motivo_indisponibilidade) {
          text += `⚠️ Motivo: ${result.motivo_indisponibilidade}\n`;
        }
        
        if (result.description) {
          text += `📝 Descrição: ${result.description}\n`;
        }

        if (result.prices && result.prices !== 'null') {
          text += `💳 Detalhes de preços: ${result.prices}\n`;
        }
        
        return text;
      }).join('\n---\n');

      // Se há itens indisponíveis, buscar alternativas automaticamente
      const unavailableItems = results.filter(r => r.disponibilidade === 'Indisponível');
      let alternativesText = '';
      
      if (unavailableItems.length > 0 && data_inicio && data_fim) {
        console.log('🔄 Buscando alternativas para itens indisponíveis...');
        const alternatives = await this.catalogService.findAlternatives(query, data_inicio, data_fim, 3);
        alternativesText = '\n\n' + alternatives.summary;
      }

      return {
        content: [
          {
            type: 'text',
            text: `**[FONTE: CATÁLOGO COM DISPONIBILIDADE]** Resultados encontrados para "${query}"${data_inicio && data_fim ? ` no período de ${data_inicio} a ${data_fim}` : ''}:\n\n${formattedResults}${alternativesText}`,
          },
        ],
      };

    } catch (error) {
      console.error('❌ Erro na busca do catálogo:', error);
      return {
        content: [
          {
            type: 'text',
            text: 'Ocorreu um erro ao buscar informações do catálogo. Por favor, tente novamente.',
          },
        ],
      };
    }
  }

  private async handleFindAlternatives(args: any) {
    const { query, data_inicio, data_fim, top_k = 3 } = args;

    console.log(`🔄 Buscando alternativas disponíveis: "${query}"`, { data_inicio, data_fim, top_k });

    try {
      const result = await this.catalogService.findAlternatives(query, data_inicio, data_fim, top_k);

      return {
        content: [
          {
            type: 'text',
            text: result.summary,
          },
        ],
      };

    } catch (error) {
      console.error('❌ Erro ao buscar alternativas:', error);
      return {
        content: [
          {
            type: 'text',
            text: 'Ocorreu um erro ao buscar alternativas disponíveis. Por favor, tente novamente.',
          },
        ],
      };
    }
  }

  private async handleCheckAvailability(args: any) {
    const { vehicle_model, store_location, data_inicio, data_fim } = args;

    console.log(`📅 Verificando disponibilidade: ${vehicle_model} em ${store_location}`, { data_inicio, data_fim });

    try {
      // Buscar específica pelo modelo e localização
      const results = await this.catalogService.searchWithAvailability(
        vehicle_model, 
        data_inicio, 
        data_fim, 
        10
      );

      // Filtrar pela localização específica
      const filteredResults = results.filter(result => 
        result.vehicleModel?.toLowerCase().includes(vehicle_model.toLowerCase()) &&
        result.store_location?.toLowerCase().includes(store_location.toLowerCase())
      );

      if (filteredResults.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Não foram encontrados veículos "${vehicle_model}" disponíveis em ${store_location} para o período solicitado.`,
            },
          ],
        };
      }

      const available = filteredResults.filter(r => r.disponibilidade === 'Disponível');
      const unavailable = filteredResults.filter(r => r.disponibilidade === 'Indisponível');

      let response = `**Verificação de Disponibilidade**\n\n`;
      response += `📍 **Localização:** ${store_location}\n`;
      response += `🏍️ **Modelo:** ${vehicle_model}\n`;
      response += `📅 **Período:** ${data_inicio} a ${data_fim}\n\n`;

      if (available.length > 0) {
        response += `✅ **Disponível (${available.length} unidade(s))**\n`;
        available.forEach((item, index) => {
          response += `- ${item.title} - ${item.formatted_total_amount_with_taxes}\n`;
        });
      } else {
        response += `❌ **Indisponível**\n`;
      }

      if (unavailable.length > 0) {
        response += `\n⚠️ **Detalhes da Indisponibilidade:**\n`;
        unavailable.forEach((item, index) => {
          response += `- ${item.motivo_indisponibilidade || 'Veículo reservado neste período'}\n`;
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

    } catch (error) {
      console.error('❌ Erro na verificação de disponibilidade:', error);
      return {
        content: [
          {
            type: 'text',
            text: 'Ocorreu um erro ao verificar a disponibilidade. Por favor, tente novamente.',
          },
        ],
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 Enhanced Catalog MCP Server running on stdio');
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new EnhancedCatalogMCPServer();
  server.run().catch(console.error);
}

export { EnhancedCatalogMCPServer };
