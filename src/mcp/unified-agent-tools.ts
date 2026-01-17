import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { EnhancedCatalogService } from '../enhanced-catalog-service.js';
import { FinalIndexer } from '../final-indexer.js';
import { SimpleExtractor } from '../simple-extractor.js';
import { GeminiEmbeddingService } from '../../evaluation/gemini-embedding-service.js';

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});

// Serviço de catálogo otimizado
class OptimizedCatalogService {
  private catalogService: EnhancedCatalogService;
  private bigQueryCache: Map<string, any> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutos

  constructor() {
    this.catalogService = new EnhancedCatalogService();
  }

  // Busca no catálogo com cache inteligente
  async searchCatalog(query: string, checkStock: boolean = false) {
    console.log(`🔍 Catalog search: "${query}" | Stock check: ${checkStock}`);
    
    try {
      // Busca básica no catálogo (sem BigQuery)
      const basicResults = await this.catalogService.searchWithAvailability(query);
      
      // Apenas verificar stock se explicitamente solicitado
      if (checkStock) {
        console.log('📊 Checking BigQuery for stock information...');
        const stockInfo = await this.getStockInfo(query);
        return {
          results: basicResults,
          stockInfo,
          source: 'catalog_with_stock'
        };
      }
      
      return {
        results: basicResults,
        source: 'catalog_basic'
      };
      
    } catch (error: any) {
      console.error('❌ Catalog search error:', error);
      return {
        error: error.message,
        source: 'catalog_error'
      };
    }
  }

  // Cache inteligente para BigQuery
  private async getStockInfo(query: string) {
    const cacheKey = `stock_${query.toLowerCase()}`;
    const cached = this.bigQueryCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log('📋 Using cached stock info');
      return cached.data;
    }

    try {
      // Simular chamada BigQuery (implementar real depois)
      const stockData = {
        query,
        available: Math.random() > 0.3,
        units: Math.floor(Math.random() * 10) + 1,
        locations: ['Tavira', 'Faro', 'Loulé'],
        lastUpdated: new Date().toISOString()
      };
      
      this.bigQueryCache.set(cacheKey, {
        data: stockData,
        timestamp: Date.now()
      });
      
      return stockData;
    } catch (error) {
      console.error('❌ BigQuery error:', error);
      return null;
    }
  }
}

// Serviço de manuais otimizado
class OptimizedManualsService {
  private indexer: FinalIndexer;
  private searchIndex: any = null;
  private geminiService: GeminiEmbeddingService;
  private isInitialized: boolean = false;

  constructor() {
    this.indexer = new FinalIndexer();
    this.geminiService = new GeminiEmbeddingService();
  }

  // Inicialização lazy dos manuais
  private async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('📚 Initializing manuals service...');
      
      // Carregar índice existente
      this.searchIndex = await this.indexer.loadIndex();
      if (this.searchIndex) {
        console.log('✅ Manual index loaded');
        this.isInitialized = true;
        return;
      }

      // Criar novo índice se não existir
      const extractor = new SimpleExtractor();
      const documents = await extractor.processAllPdfs();
      this.searchIndex = this.indexer.buildSearchIndex(documents);
      await this.indexer.saveIndex(this.searchIndex);
      
      this.isInitialized = true;
      console.log('✅ Manual index created and saved');
      
    } catch (error) {
      console.error('❌ Manuals initialization error:', error);
      throw error;
    }
  }

  // Busca em manuais
  async searchManuals(query: string, maxResults: number = 3) {
    console.log(`🔖 Manual search: "${query}"`);
    
    await this.initialize();
    
    try {
      const results = this.indexer.search(query, this.searchIndex);
      
      return {
        query,
        results: results.slice(0, maxResults),
        totalFound: results.length,
        source: 'manuals'
      };
      
    } catch (error: any) {
      console.error('❌ Manual search error:', error);
      return {
        query,
        error: error.message,
        source: 'manuals_error'
      };
    }
  }
}

// Instâncias dos serviços
const catalogService = new OptimizedCatalogService();
const manualsService = new OptimizedManualsService();

// Tool de catálogo integrada
export const enhancedCatalogTool = ai.defineTool(
  {
    name: 'enhanced_catalog_search',
    description: 'Busca veículos no catálogo Honda com verificação de stock opcional',
    inputSchema: z.object({
      query: z.string().describe('Busca do cliente (ex: "PCX 125", "moto para cidade")'),
      checkStock: z.boolean().optional().default(false).describe('Verificar stock em BigQuery (apenas se necessário)'),
      maxResults: z.number().optional().default(5).describe('Número máximo de resultados'),
    }),
  },
  async ({ query, checkStock, maxResults }) => {
    const result = await catalogService.searchCatalog(query, checkStock);
    
    if (result.error) {
      return `**[FONTE: CATÁLOGO]** Erro na busca: ${result.error}`;
    }
    
    // Formatar resposta concisa
    let response = `**[FONTE: CATÁLOGO]** `;
    
    if (result.results && result.results.length > 0) {
      const vehicles = result.results.slice(0, maxResults);
      const vehicleList = vehicles.map((v: any) => 
        `${v.title} - ${v.formatted_total_amount_with_taxes || 'Preço sob consulta'}`
      ).join(' | ');
      
      response += vehicleList;
      
      if (checkStock && result.stockInfo) {
        response += ` | Stock: ${result.stockInfo.available ? `${result.stockInfo.units} unidades` : 'Indisponível'}`;
      }
    } else {
      response += 'Nenhum veículo encontrado para esta busca.';
    }
    
    return response;
  },
);

// Tool de manuais integrada
export const enhancedManualsTool = ai.defineTool(
  {
    name: 'enhanced_manuals_search',
    description: 'Busca informações técnicas nos manuais Honda',
    inputSchema: z.object({
      query: z.string().describe('Pergunta técnica (ex: "pressão pneus PCX", "folga acelerador")'),
      maxResults: z.number().optional().default(3).describe('Número máximo de resultados'),
    }),
  },
  async ({ query, maxResults }) => {
    const result = await manualsService.searchManuals(query, maxResults);
    
    if (result.error) {
      return `**[FONTE: MANUAL]** Erro na busca: ${result.error}`;
    }
    
    if (result.results && result.results.length > 0) {
      const snippets = result.results.slice(0, maxResults).map((r, i) => 
        `${r.model} - ${r.section}: ${r.content.substring(0, 150)}...`
      ).join('\n');
      
      return `**[FONTE: MANUAL]**\n${snippets}`;
    }
    
    return `**[FONTE: MANUAL]** Nenhuma informação técnica encontrada para: ${query}`;
  },
);

// Tool de analytics (mantida)
export const analyticsTool = ai.defineTool(
  {
    name: 'analytics_tool',
    description: 'Obtém métricas e estatísticas de utilização',
    inputSchema: z.object({
      metric: z.string().describe('Tipo de métrica (ex: "active_users", "page_views", "traffic")'),
      period: z.string().optional().describe('Período (ex: "today", "week", "month")'),
    }),
  },
  async ({ metric, period }) => {
    // Simular resposta de analytics
    const responses: Record<string, string> = {
      active_users: '15 utilizadores ativos agora',
      page_views: '245 visualizações esta semana',
      traffic: '1,234 visitantes esta semana'
    };
    
    const response = responses[metric] || 'Métrica não disponível';
    return `**[FONTE: ANALYTICS]** ${response}`;
  },
);
