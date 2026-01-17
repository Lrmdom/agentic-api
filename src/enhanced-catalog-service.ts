import { genkit, z } from 'genkit';
import { GoogleAuth } from 'google-auth-library';
import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

// Configuração
const GOOGLE_CLOUD_PROJECT_ID = process.env.GCP_PROJECT_ID || 'avid-infinity-370500';
const EVENTS_DATASET = 'events_data_dataset';
const EVENTS_TABLE = 'events-data-table';
const CATALOG_TABLE = 'master_catalog_rag';

// Configuração BigQuery
let clientOptions: any = { projectId: GOOGLE_CLOUD_PROJECT_ID };

if (fs.existsSync('avid-infinity-370500-d9f7e84d26a4.json')) {
  const credentialsJson = fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8');
  clientOptions.credentials = JSON.parse(credentialsJson);
}

const bq = new BigQuery(clientOptions);

export interface EnhancedCatalogResult {
  sku_code: string;
  title: string;
  vehicleModel: string;
  store_location: string;
  formatted_total_amount_with_taxes?: string;
  disponibilidade: string;
  motivo_indisponibilidade?: string;
  distance: number;
  prices?: any;
  description?: string;
  vehicle_models?: any;
}

export interface AvailabilityCheckResult {
  available: EnhancedCatalogResult[];
  unavailable: EnhancedCatalogResult[];
  summary: string;
}

/**
 * Serviço de busca de catálogo aprimorado com verificação de disponibilidade
 */
export class EnhancedCatalogService {
  
  /**
   * Busca itens no catálogo e verifica disponibilidade para as datas solicitadas
   */
  async searchWithAvailability(
    query: string, 
    dataInicio?: string, 
    dataFim?: string, 
    topK: number = 5
  ): Promise<EnhancedCatalogResult[]> {
    console.log('🔍 Iniciando busca com verificação de disponibilidade:', { query, dataInicio, dataFim, topK });
    
    const enhancedQuery = `
      WITH 
      -- Vector search for relevant catalog items
      vector_results AS (
        SELECT 
          base.sku_code,
          base.title,
          base.content_json,
          JSON_VALUE(base.content_json, '$.vehicleModels[0].name') AS vehicleModel,
          JSON_VALUE(base.content_json, '$.vehicleModels[0].vehicles[0].location.name') AS store_location,
          JSON_VALUE(base.content_json, '$.formatted_total_amount_with_taxes') AS formatted_total_amount_with_taxes
        FROM VECTOR_SEARCH(
          TABLE \`${GOOGLE_CLOUD_PROJECT_ID}.${EVENTS_DATASET}.${CATALOG_TABLE}\`,
          'embedding',
          (SELECT ml_generate_embedding_result 
           FROM ML.GENERATE_EMBEDDING(
             MODEL \`${GOOGLE_CLOUD_PROJECT_ID}.${EVENTS_DATASET}.text-embedding-004\`,
             (SELECT @query as content)
           )),
          top_k => @top_k
        ) AS busca
      ),
      
      -- Existing bookings for the requested period
      existing_bookings AS (
        SELECT 
          vehicleModel,
          store_location,
          sku_code,
          start_Date,
          end_Date,
          id as booking_id,
          vehicle_registration_number
        FROM \`${GOOGLE_CLOUD_PROJECT_ID}.${EVENTS_DATASET}.${EVENTS_TABLE}\`
        WHERE 
          (status = 'approved' OR payment_status = 'paid')
          AND (@data_inicio IS NULL OR @data_fim IS NULL OR
               (SAFE.PARSE_DATE('%Y-%m-%d', start_Date) <= SAFE.PARSE_DATE('%Y-%m-%d', @data_fim)) AND 
               (SAFE.PARSE_DATE('%Y-%m-%d', end_Date) >= SAFE.PARSE_DATE('%Y-%m-%d', @data_inicio))
              )
      ),
      
      -- Join catalog with bookings to check availability
      catalog_with_bookings AS (
        SELECT 
          vr.sku_code,
          vr.title,
          vr.content_json,
          vr.vehicleModel,
          vr.store_location,
          vr.formatted_total_amount_with_taxes,
          eb.booking_id,
          eb.start_Date,
          eb.end_Date,
          eb.vehicle_registration_number,
          eb.store_location as booking_location
        FROM vector_results vr
        LEFT JOIN existing_bookings eb ON 
          (LOWER(vr.vehicleModel) LIKE '%pcx%' AND LOWER(eb.vehicleModel) LIKE '%pcx%')
          OR (LOWER(vr.vehicleModel) LIKE '%sh%' AND LOWER(eb.vehicleModel) LIKE '%sh%')
          OR (LOWER(vr.vehicleModel) LIKE '%forza%' AND LOWER(eb.vehicleModel) LIKE '%forza%')
      )
      
      SELECT 
        sku_code,
        title,
        vehicleModel,
        store_location,
        formatted_total_amount_with_taxes,
        CASE 
          WHEN @data_inicio IS NULL OR @data_fim IS NULL THEN 'Não verificado'
          WHEN booking_id IS NOT NULL THEN 'Indisponível'
          ELSE 'Disponível'
        END AS disponibilidade,
        CASE 
          WHEN booking_id IS NOT NULL THEN CONCAT('Reservado de ', start_Date, ' até ', end_Date, ' (ID: ', booking_id, ')')
          ELSE NULL
        END AS motivo_indisponibilidade,
        JSON_QUERY(content_json, '$.prices') as prices,
        JSON_QUERY(content_json, '$.description') as description,
        JSON_QUERY(content_json, '$.vehicleModels') as vehicle_models
      FROM catalog_with_bookings
    `;

    try {
      const [rows] = await bq.query({
        query: enhancedQuery,
        params: {
          query: query,
          data_inicio: dataInicio || null,
          data_fim: dataFim || null,
          top_k: topK
        },
        types: {
          query: 'STRING',
          data_inicio: 'STRING',
          data_fim: 'STRING', 
          top_k: 'INT64'
        },
        ...clientOptions
      });

      console.log(`✅ Busca concluída: ${rows.length} resultados encontrados`);
      return rows as EnhancedCatalogResult[];

    } catch (error) {
      console.error('❌ Erro na busca com disponibilidade:', error);
      throw error;
    }
  }

  /**
   * Encontra alternativas disponíveis quando os itens solicitados estão indisponíveis
   */
  async findAlternatives(
    query: string, 
    dataInicio?: string, 
    dataFim?: string, 
    topK: number = 5
  ): Promise<AvailabilityCheckResult> {
    console.log('🔄 Buscando alternativas disponíveis:', { query, dataInicio, dataFim });

    const alternativesQuery = `
      WITH 
      -- Vector search for relevant items
      vector_results AS (
        SELECT 
          base.sku_code,
          base.title,
          base.content_json,
          JSON_VALUE(base.content_json, '$.vehicleModels[0].name') AS vehicleModel,
          JSON_VALUE(base.content_json, '$.vehicleModels[0].vehicles[0].location.name') AS store_location,
          JSON_VALUE(base.content_json, '$.formatted_total_amount_with_taxes') AS formatted_total_amount_with_taxes
        FROM VECTOR_SEARCH(
          TABLE \`${GOOGLE_CLOUD_PROJECT_ID}.${EVENTS_DATASET}.${CATALOG_TABLE}\`,
          'embedding',
          (SELECT ml_generate_embedding_result 
           FROM ML.GENERATE_EMBEDDING(
             MODEL \`${GOOGLE_CLOUD_PROJECT_ID}.${EVENTS_DATASET}.text-embedding-004\`,
             (SELECT @query as content)
           )),
          top_k => 20
        ) AS busca
      ),
      
      -- Existing bookings
      existing_bookings AS (
        SELECT 
          vehicleModel,
          store_location,
          sku_code,
          start_Date,
          end_Date,
          vehicle_registration_number
        FROM \`${GOOGLE_CLOUD_PROJECT_ID}.${EVENTS_DATASET}.${EVENTS_TABLE}\`
        WHERE 
          (status = 'approved' OR payment_status = 'paid')
          AND (@data_inicio IS NOT NULL AND @data_fim IS NOT NULL)
          AND (SAFE.PARSE_DATE('%Y-%m-%d', start_Date) <= SAFE.PARSE_DATE('%Y-%m-%d', @data_fim)) 
          AND (SAFE.PARSE_DATE('%Y-%m-%d', end_Date) >= SAFE.PARSE_DATE('%Y-%m-%d', @data_inicio))
      ),
      
      -- Join to check availability
      catalog_with_availability AS (
        SELECT 
          vr.*,
          CASE WHEN eb.vehicleModel IS NOT NULL THEN 'unavailable' ELSE 'available' END AS availability_status,
          eb.store_location as booking_location
        FROM vector_results vr
        LEFT JOIN existing_bookings eb ON 
          (LOWER(vr.vehicleModel) LIKE '%pcx%' AND LOWER(eb.vehicleModel) LIKE '%pcx%')
          OR (LOWER(vr.vehicleModel) LIKE '%sh%' AND LOWER(eb.vehicleModel) LIKE '%sh%')
          OR (LOWER(vr.vehicleModel) LIKE '%forza%' AND LOWER(eb.vehicleModel) LIKE '%forza%')
      )
      
      SELECT 
        sku_code,
        title,
        vehicleModel,
        store_location,
        formatted_total_amount_with_taxes,
        availability_status,
        JSON_QUERY(content_json, '$.prices') as prices,
        JSON_QUERY(content_json, '$.description') as description
      FROM catalog_with_availability
      ORDER BY 
        CASE WHEN availability_status = 'available' THEN 1 ELSE 2 END
      LIMIT @top_k
    `;

    try {
      const [rows] = await bq.query({
        query: alternativesQuery,
        params: {
          query: query,
          data_inicio: dataInicio || null,
          data_fim: dataFim || null,
          top_k: topK
        },
        types: {
          query: 'STRING',
          data_inicio: 'STRING',
          data_fim: 'STRING',
          top_k: 'INT64'
        },
        ...clientOptions
      });

      const available = rows.filter((row: any) => row.availability_status === 'available');
      const unavailable = rows.filter((row: any) => row.availability_status === 'unavailable');

      const summary = this.generateAlternativesSummary(available, unavailable, query, dataInicio, dataFim);

      return {
        available: available as EnhancedCatalogResult[],
        unavailable: unavailable as EnhancedCatalogResult[],
        summary
      };

    } catch (error) {
      console.error('❌ Erro ao buscar alternativas:', error);
      throw error;
    }
  }

  /**
   * Gera um resumo formatado das alternativas encontradas
   */
  private generateAlternativesSummary(
    available: any[], 
    unavailable: any[], 
    query: string, 
    dataInicio?: string, 
    dataFim?: string
  ): string {
    let summary = `**[FONTE: CATÁLOGO COM ALTERNATIVAS]** Alternativas para "${query}"${dataInicio && dataFim ? ` no período de ${dataInicio} a ${dataFim}` : ''}:\n\n`;

    if (unavailable.length > 0) {
      summary += `🔴 **Itens solicitados indisponíveis:**\n`;
      unavailable.forEach((row: any, index: number) => {
        summary += `- ${row.title} em ${row.store_location} - ${row.formatted_total_amount_with_taxes}\n`;
      });
      summary += '\n';
    }

    if (available.length > 0) {
      summary += `✅ **Alternativas disponíveis:**\n`;
      available.forEach((row: any, index: number) => {
        summary += `- ${row.title} em ${row.store_location} - ${row.formatted_total_amount_with_taxes}\n`;
        if (row.description) {
          summary += `  📝 ${row.description}\n`;
        }
      });
    } else {
      summary += '❌ Não foram encontradas alternativas disponíveis para o período solicitado.\n';
    }

    return summary;
  }

  /**
   * Cria a ferramenta para o Genkit usar o serviço de catálogo aprimorado
   */
  createEnhancedCatalogTool(ai: any) {
    return ai.defineTool(
      {
        name: 'searchEnhancedCatalog',
        description: 'Busca veículos no catálogo com verificação de disponibilidade em tempo real',
        inputSchema: z.object({
          query: z.string().describe('A busca do cliente (ex: "PCX 125", "moto para cidade", "scooter econômico")'),
          data_inicio: z.string().optional().describe('Data de início pretendida (formato YYYY-MM-DD)'),
          data_fim: z.string().optional().describe('Data de fim pretendida (formato YYYY-MM-DD)'),
          top_k: z.number().optional().default(5).describe('Número máximo de resultados'),
        }),
      },
      async ({ query, data_inicio, data_fim, top_k }: { 
        query: string; 
        data_inicio?: string; 
        data_fim?: string; 
        top_k?: number 
      }) => {
        try {
          const results = await this.searchWithAvailability(query, data_inicio, data_fim, top_k);
          
          if (results.length === 0) {
            return 'Não foram encontrados veículos correspondentes à sua busca.';
          }

          // Formatar resultados para o agente
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
            
            return text;
          }).join('\n---\n');

          // Se há itens indisponíveis, buscar alternativas automaticamente
          const unavailableItems = results.filter(r => r.disponibilidade === 'Indisponível');
          let alternativesText = '';
          
          if (unavailableItems.length > 0 && data_inicio && data_fim) {
            console.log('🔄 Buscando alternativas para itens indisponíveis...');
            const alternatives = await this.findAlternatives(query, data_inicio, data_fim, 3);
            alternativesText = '\n\n' + alternatives.summary;
          }

          return `**[FONTE: CATÁLOGO COM DISPONIBILIDADE]** Resultados encontrados para "${query}"${data_inicio && data_fim ? ` no período de ${data_inicio} a ${data_fim}` : ''}:\n\n${formattedResults}${alternativesText}`;

        } catch (error) {
          console.error('❌ Erro na ferramenta de catálogo aprimorado:', error);
          return 'Ocorreu um erro ao buscar informações do catálogo. Por favor, tente novamente.';
        }
      }
    );
  }

  /**
   * Cria a ferramenta especializada para encontrar alternativas
   */
  createFindAlternativesTool(ai: any) {
    return ai.defineTool(
      {
        name: 'findAvailableAlternatives',
        description: 'Encontra alternativas disponíveis quando os veículos solicitados estão reservados',
        inputSchema: z.object({
          query: z.string().describe('A busca original do cliente'),
          data_inicio: z.string().describe('Data de início pretendida (formato YYYY-MM-DD)'),
          data_fim: z.string().describe('Data de fim pretendida (formato YYYY-MM-DD)'),
          top_k: z.number().optional().default(3).describe('Número máximo de alternativas'),
        }),
      },
      async ({ query, data_inicio, data_fim, top_k }: { 
        query: string; 
        data_inicio: string; 
        data_fim: string; 
        top_k?: number 
      }) => {
        try {
          const result = await this.findAlternatives(query, data_inicio, data_fim, top_k);
          return result.summary;

        } catch (error) {
          console.error('❌ Erro ao buscar alternativas:', error);
          return 'Ocorreu um erro ao buscar alternativas disponíveis. Por favor, tente novamente.';
        }
      }
    );
  }
}
