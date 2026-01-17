import { Hono } from "hono";
import { BigQuery } from "@google-cloud/bigquery";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getGoogleCloudConfigWithCredentials } from "../utils/google-auth.js";

// Configuração para produção/desenvolvimento usando helper centralizado
const clientOptions = getGoogleCloudConfigWithCredentials();

// Initialize BigQuery client with proper configuration
const bigquery = new BigQuery(clientOptions);

// Connection and location settings
const BIGQUERY_LOCATION = "europe-southwest1";
const CONNECTION_LOCATION = "europe-southwest1";

// Configuração de conexão usando helper centralizado
const connectionSettings = {
  projectId: clientOptions.projectId,
  location: BIGQUERY_LOCATION,
};

// Define request schema for enhanced catalog search
const enhancedCatalogSearchSchema = z.object({
  query: z.string().min(1, "Query is required"),
  data_inicio: z.string().optional().describe('Data de início no formato YYYY-MM-DD'),
  data_fim: z.string().optional().describe('Data de fim no formato YYYY-MM-DD'),
  top_k: z.number().optional().default(5).describe('Número máximo de resultados'),
});

// Create router
export const enhancedCatalogRouter = new Hono();

// Enhanced catalog search endpoint with availability checking
enhancedCatalogRouter.post("/search", zValidator("json", enhancedCatalogSearchSchema), async (c) => {
  try {
    const { query, data_inicio, data_fim, top_k } = c.req.valid("json");
    console.log("Starting enhanced catalog search with availability check:", { query, data_inicio, data_fim, top_k });

    if (!process.env.GCP_PROJECT_ID) {
      throw new Error("GCP_PROJECT_ID environment variable is not set");
    }

    const projectId = process.env.GCP_PROJECT_ID;

    // Build the enhanced query with availability checking
    let enhancedQuery = `
      WITH 
      -- Vector search for relevant catalog items
      vector_results AS (
        SELECT 
          base.sku_code,
          base.title,
          base.content_json,
          base.vehicleModel,
          base.store_location,
          base.formatted_total_amount_with_taxes,
          ML.COSINE_DISTANCE(base.embedding, embedding) AS distance
        FROM VECTOR_SEARCH(
          TABLE \`${projectId}.events_data_dataset.master_catalog_rag\`,
          'embedding',
          (SELECT ml_generate_embedding_result 
           FROM ML.GENERATE_EMBEDDING(
             MODEL \`${projectId}.events_data_dataset.text-embedding-004\`,
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
          booking_id
        FROM \`${projectId}.events_data_dataset.events-data-table\`
        WHERE 
          (status = 'approved' OR payment_status = 'paid')
          AND (
            (@data_inicio IS NOT NULL AND @data_fim IS NOT NULL AND
             (PARSE_DATE('%Y-%m-%d', start_Date) <= PARSE_DATE('%Y-%m-%d', @data_fim)) AND 
             (PARSE_DATE('%Y-%m-%d', end_Date) >= PARSE_DATE('%Y-%m-%d', @data_inicio))
            )
            OR (@data_inicio IS NULL OR @data_fim IS NULL)  -- No date filter
          )
      ),
      
      -- Availability check for each vehicle
      availability_check AS (
        SELECT 
          vr.sku_code,
          vr.title,
          vr.content_json,
          vr.vehicleModel,
          vr.store_location,
          vr.formatted_total_amount_with_taxes,
          vr.distance,
          CASE 
            WHEN @data_inicio IS NULL OR @data_fim IS NULL THEN 'Não verificado'
            WHEN EXISTS (
              SELECT 1 FROM existing_bookings eb 
              WHERE eb.vehicleModel = vr.vehicleModel 
                AND eb.store_location = vr.store_location
                AND PARSE_DATE('%Y-%m-%d', eb.start_Date) <= PARSE_DATE('%Y-%m-%d', @data_fim)
                AND PARSE_DATE('%Y-%m-%d', eb.end_Date) >= PARSE_DATE('%Y-%m-%d', @data_inicio)
            ) THEN 'Indisponível'
            ELSE 'Disponível'
          END AS disponibilidade,
          CASE 
            WHEN @data_inicio IS NULL OR @data_fim IS NULL THEN NULL
            WHEN EXISTS (
              SELECT 1 FROM existing_bookings eb 
              WHERE eb.vehicleModel = vr.vehicleModel 
                AND eb.store_location = vr.store_location
                AND PARSE_DATE('%Y-%m-%d', eb.start_Date) <= PARSE_DATE('%Y-%m-%d', @data_fim)
                AND PARSE_DATE('%Y-%m-%d', eb.end_Date) >= PARSE_DATE('%Y-%m-%d', @data_inicio)
            ) THEN (
              SELECT CONCAT('Reservado de ', eb.start_Date, ' até ', eb.end_Date, ' (ID: ', eb.booking_id, ')')
              FROM existing_bookings eb 
              WHERE eb.vehicleModel = vr.vehicleModel 
                AND eb.store_location = vr.store_location
                AND PARSE_DATE('%Y-%m-%d', eb.start_Date) <= PARSE_DATE('%Y-%m-%d', @data_fim)
                AND PARSE_DATE('%Y-%m-%d', eb.end_Date) >= PARSE_DATE('%Y-%m-%d', @data_inicio)
              LIMIT 1
            )
            ELSE NULL
          END AS motivo_indisponibilidade
        FROM vector_results vr
      )
      
      SELECT 
        sku_code,
        title,
        vehicleModel,
        store_location,
        formatted_total_amount_with_taxes,
        disponibilidade,
        motivo_indisponibilidade,
        distance,
        JSON_QUERY(content_json, '$.prices') as prices,
        JSON_QUERY(content_json, '$.description') as description,
        JSON_QUERY(content_json, '$.vehicleModels') as vehicle_models
      FROM availability_check
      ORDER BY distance ASC
    `;

    // Execute the enhanced query
    const [rows] = await bigquery.query({
      query: enhancedQuery,
      params: {
        query: query,
        data_inicio: data_inicio || null,
        data_fim: data_fim || null,
        top_k: top_k
      },
      ...connectionSettings,
    });

    console.log("Enhanced catalog search completed:", { resultsCount: rows.length });

    // Format the response for the AI agent
    const formattedResults = rows.map((row: any, index: number) => {
      let resultText = `**Resultado ${index + 1}**\n`;
      resultText += `📋 Modelo: ${row.title || row.vehicleModel}\n`;
      resultText += `🏪 Localização: ${row.store_location || 'N/A'}\n`;
      resultText += `💰 Preço: ${row.formatted_total_amount_with_taxes || 'Consultar'}\n`;
      resultText += `📅 Disponibilidade: ${row.disponibilidade}\n`;
      
      if (row.motivo_indisponibilidade) {
        resultText += `⚠️ Motivo: ${row.motivo_indisponibilidade}\n`;
      }
      
      if (row.description) {
        resultText += `📝 Descrição: ${row.description}\n`;
      }
      
      if (row.prices && row.prices !== 'null') {
        resultText += `💳 Detalhes de preços: ${row.prices}\n`;
      }
      
      return resultText;
    }).join('\n---\n');

    const response = `**[FONTE: CATÁLOGO COM DISPONIBILIDADE]** Resultados encontrados para "${query}"${data_inicio && data_fim ? ` no período de ${data_inicio} a ${data_fim}` : ''}:\n\n${formattedResults}`;

    return c.json({
      success: true,
      response,
      results: rows,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Error in enhanced catalog search:", error);

    let errorMessage = "Erro ao buscar catálogo com disponibilidade. Tente novamente.";
    let statusCode = 500;

    if ((error as any)?.code === "PERMISSION_DENIED") {
      errorMessage = "Permissão negada. Verifique as permissões da conta de serviço.";
      statusCode = 403;
    } else if ((error as any)?.code === "NOT_FOUND") {
      errorMessage = "Recurso não encontrado. Verifique a configuração do BigQuery.";
      statusCode = 404;
    }

    return c.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? {
          message: (error as any)?.message,
          code: (error as any)?.code,
        } : undefined,
      },
      statusCode as any,
    );
  }
});

// Alternative endpoint for finding available alternatives
enhancedCatalogRouter.post("/find-alternatives", zValidator("json", enhancedCatalogSearchSchema), async (c) => {
  try {
    const { query, data_inicio, data_fim, top_k } = c.req.valid("json");
    console.log("Finding available alternatives:", { query, data_inicio, data_fim, top_k });

    if (!process.env.GCP_PROJECT_ID) {
      throw new Error("GCP_PROJECT_ID environment variable is not set");
    }

    const projectId = process.env.GCP_PROJECT_ID;

    // Query to find available alternatives when requested items are unavailable
    const alternativesQuery = `
      WITH 
      -- Vector search for relevant items
      vector_results AS (
        SELECT 
          base.sku_code,
          base.title,
          base.content_json,
          base.vehicleModel,
          base.store_location,
          base.formatted_total_amount_with_taxes,
          ML.COSINE_DISTANCE(base.embedding, embedding) AS distance
        FROM VECTOR_SEARCH(
          TABLE \`${projectId}.events_data_dataset.master_catalog_rag\`,
          'embedding',
          (SELECT ml_generate_embedding_result 
           FROM ML.GENERATE_EMBEDDING(
             MODEL \`${projectId}.events_data_dataset.text-embedding-004\`,
             (SELECT @query as content)
           )),
          top_k => 20  -- Get more results to find alternatives
        ) AS busca
      ),
      
      -- Existing bookings
      existing_bookings AS (
        SELECT 
          vehicleModel,
          store_location,
          sku_code,
          start_Date,
          end_Date
        FROM \`${projectId}.events_data_dataset.events-data-table\`
        WHERE 
          (status = 'approved' OR payment_status = 'paid')
          AND (@data_inicio IS NOT NULL AND @data_fim IS NOT NULL)
          AND (PARSE_DATE('%Y-%m-%d', start_Date) <= PARSE_DATE('%Y-%m-%d', @data_fim)) 
          AND (PARSE_DATE('%Y-%m-%d', end_Date) >= PARSE_DATE('%Y-%m-%d', @data_inicio))
      ),
      
      -- Categorize items by availability
      categorized_items AS (
        SELECT 
          vr.*,
          CASE 
            WHEN @data_inicio IS NULL OR @data_fim IS NULL THEN 'not_checked'
            WHEN EXISTS (
              SELECT 1 FROM existing_bookings eb 
              WHERE eb.vehicleModel = vr.vehicleModel 
                AND eb.store_location = vr.store_location
            ) THEN 'unavailable'
            ELSE 'available'
          END AS availability_status
        FROM vector_results vr
      )
      
      SELECT 
        sku_code,
        title,
        vehicleModel,
        store_location,
        formatted_total_amount_with_taxes,
        availability_status,
        distance,
        JSON_QUERY(content_json, '$.prices') as prices,
        JSON_QUERY(content_json, '$.description') as description
      FROM categorized_items
      ORDER BY 
        CASE WHEN availability_status = 'available' THEN 1 ELSE 2 END,
        distance ASC
      LIMIT @top_k
    `;

    const [rows] = await bigquery.query({
      query: alternativesQuery,
      params: {
        query: query,
        data_inicio: data_inicio || null,
        data_fim: data_fim || null,
        top_k: top_k
      },
      ...connectionSettings,
    });

    // Separate available and unavailable items
    const available = rows.filter((row: any) => row.availability_status === 'available');
    const unavailable = rows.filter((row: any) => row.availability_status === 'unavailable');

    let response = `**[FONTE: CATÁLOGO COM ALTERNATIVAS]** Alternativas para "${query}"${data_inicio && data_fim ? ` no período de ${data_inicio} a ${data_fim}` : ''}:\n\n`;

    if (unavailable.length > 0) {
      response += `🔴 **Itens solicitados indisponíveis:**\n`;
      unavailable.forEach((row: any, index: number) => {
        response += `- ${row.title} em ${row.store_location} - ${row.formatted_total_amount_with_taxes}\n`;
      });
      response += '\n';
    }

    if (available.length > 0) {
      response += `✅ **Alternativas disponíveis:**\n`;
      available.forEach((row: any, index: number) => {
        response += `- ${row.title} em ${row.store_location} - ${row.formatted_total_amount_with_taxes}\n`;
        if (row.description) {
          response += `  📝 ${row.description}\n`;
        }
      });
    } else {
      response += '❌ Não foram encontradas alternativas disponíveis para o período solicitado.\n';
    }

    return c.json({
      success: true,
      response,
      available,
      unavailable,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Error finding alternatives:", error);
    
    return c.json(
      {
        success: false,
        error: "Erro ao buscar alternativas. Tente novamente.",
        details: process.env.NODE_ENV === "development" ? {
          message: (error as any)?.message,
        } : undefined,
      },
      500,
    );
  }
});
