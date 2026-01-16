import { Hono } from "hono";
import { BigQuery } from "@google-cloud/bigquery";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

// Configuração para produção/desenvolvimento
const isProduction = process.env.NODE_ENV === "production" || process.env.K_SERVICE || process.env.K_REVISION;
const GOOGLE_CLOUD_PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "avid-infinity-370500";

let clientOptions: any = { projectId: GOOGLE_CLOUD_PROJECT_ID };

if (isProduction) {
  console.log("☁️ Produção: Usando Workload Identity para BigQuery.");
  // Em produção, usa Workload Identity (sem credenciais explícitas)
} else {
  // Em desenvolvimento, tenta usar arquivo local se existir
  const fs = await import("node:fs");
  const credentialsPath = "./avid-infinity-370500-d9f7e84d26a4.json";
  
  try {
    if (fs.existsSync(credentialsPath)) {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
      clientOptions.credentials = credentials;
      console.log("💻 Dev: Usando credenciais locais para BigQuery.");
    }
  } catch (e) {
    console.log("⚠️ Nenhuma credencial local encontrada. Usando ADC.");
  }
}

// Initialize BigQuery client with proper configuration
const bigquery = new BigQuery(clientOptions);

// Connection and location settings
const BIGQUERY_LOCATION = "europe-southwest1"; // Dataset location
const CONNECTION_LOCATION = "europe-southwest1"; // Connection location

// Connection settings for query
const connectionSettings = {
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  location: BIGQUERY_LOCATION,
};

// Define request schema
const chatSchema = z.object({
  message: z.string().min(1, "Message is required").optional(),
  question: z.string().min(1, "Question is required").optional(),
  userId: z.string().min(1, "User ID is required"),
}).refine((data) => data.message || data.question, {
  message: "Either message or question is required",
  path: ["message"],
});

// Create router
export const chatRouter = new Hono();

// Test endpoint to verify BigQuery connection
chatRouter.get("/test-connection", async (c) => {
  try {
    console.log("Testing BigQuery connection...");

    if (!process.env.GCP_PROJECT_ID) {
      throw new Error("GCP_PROJECT_ID environment variable is not set");
    }

    const projectId = process.env.GCP_PROJECT_ID;

    // Get all tables in the dataset
    const [tables] = await bigquery.query({
      query: `SELECT * FROM \`${projectId}.events_data_dataset.INFORMATION_SCHEMA.TABLES\` ORDER BY table_name`,
      ...connectionSettings,
    });

    // Get schema information for all tables
    const tableSchemas: any = {};

    for (const table of tables) {
      try {
        const [schema] = await bigquery.query({
          query: `SELECT * FROM \`${projectId}.events_data_dataset.INFORMATION_SCHEMA.COLUMNS\` 
                  WHERE table_name = @tableName 
                  ORDER BY ordinal_position`,
          params: { tableName: table.table_name },
          ...connectionSettings,
        });
        tableSchemas[table.table_name] = schema;
      } catch (error: any) {
        console.error(`Error getting schema for table ${table.table_name}:`, error);
        tableSchemas[table.table_name] = { error: error.message };
      }
    }

    // Check if required tables and models exist
    const requiredTables = ['master_catalog_rag'];
    const requiredModels = ['modelo_final', 'modelo_embedding_madrid'];
    
    const missingTables = requiredTables.filter(
      (table: string) => !(tables as any[]).some((t: any) => t.table_name === table)
    );
    
    // Check models if we can access them
    let models: any[] = [];
    let missingModels: string[] = [];
    
    try {
      const modelResults = await bigquery.query({
        query: `SELECT model_name FROM \`${projectId}.events_data_dataset.INFORMATION_SCHEMA.MODELS\`
          WHERE model_name IN UNNEST(@modelNames)`,
        params: {
          modelNames: requiredModels,
        },
        ...connectionSettings,
      });
      
      models = (modelResults[0] as any[]).map((m: any) => m.model_name);
      missingModels = requiredModels.filter((m: string) => !models.includes(m));
    } catch (modelError) {
      console.error('Error checking ML models:', modelError);
      missingModels = requiredModels;
    }

    return c.json({
      success: true,
      connectionTest: 'successful',
      projectId: projectId,
      datasetLocation: BIGQUERY_LOCATION,
      tables: (tables as any[]).map((t: any) => t.table_name),
      tableDetails: tables,
      tableSchemas,
      foundModels: models,
      missingRequiredTables: missingTables,
      missingRequiredModels: missingModels,
      message: 'Successfully connected to BigQuery',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in test endpoint:", error);
    
    let statusCode = 500;
    if (error?.code === "PERMISSION_DENIED") {
      statusCode = 403;
    } else if (error?.code === "NOT_FOUND") {
      statusCode = 404;
    }
    
    return c.json(
      {
        success: false,
        error: "Connection test failed",
        details: error?.message ? {
          message: error.message,
          code: error.code,
          errors: error.errors,
        } : undefined,
      },
      500,
    );
  }
});

// Chat endpoint
chatRouter.post("/chat", zValidator("json", chatSchema), async (c) => {
  try {
    const { message, question, userId } = c.req.valid("json");
    const userInput = message || question;
    console.log("Starting chat request for user:", userId);

    if (!process.env.GCP_PROJECT_ID) {
      throw new Error("GCP_PROJECT_ID environment variable is not set");
    }

    const projectId = process.env.GCP_PROJECT_ID;
    const query = `
      SELECT 
        JSON_VALUE(ml_generate_text_result, '$.candidates[0].content.parts[0].text') as resposta_ia
      FROM ML.GENERATE_TEXT(
        MODEL \`${projectId}.events_data_dataset.modelo_final\`,
        (
          SELECT 
            CONCAT(
              "És um assistente de vendas em Portugal. Hoje é ", 
              CAST(CURRENT_DATE() AS STRING), 
              ". ",
              "O cliente quer: '", 
              @userInput, 
              "'. ",
              "\\nUsa estes dados reais:\\n",
              COALESCE(dados_agregados, 'Nenhum veículo encontrado')
            ) as prompt
          FROM (
            SELECT 
              STRING_AGG(
                CONCAT(
                  "Veículo: ", 
                  base.title, 
                  " | Preços: ", 
                  TO_JSON_STRING(JSON_QUERY(base.content_json, '$.prices')),
                  " | Descrição: ", 
                  JSON_VALUE(base.content_json, '$.description')
                ), 
                " \\n "
              ) as dados_agregados
            FROM VECTOR_SEARCH(
              TABLE \`${projectId}.events_data_dataset.master_catalog_rag\`,
              'embedding',
              (SELECT ml_generate_embedding_result 
               FROM ML.GENERATE_EMBEDDING(
                 MODEL \`${projectId}.events_data_dataset.modelo_embedding_madrid\`,
                 (SELECT @userInput as content)
               )),
              top_k => 2
            ) AS busca
          )
        ),
        STRUCT(0.3 AS temperature, 1000 AS max_output_tokens)
      )
    `;

    // Log the query for debugging (remove in production)
    console.log("Executing BigQuery query with parameters:", {
      query: query,
      params: { userInput: userInput },
      ...connectionSettings,
    });

    // Run query with parameter and connection settings
    const [rows] = await bigquery.query({
      query: query,
      params: {
        userInput: userInput,
      },
      ...connectionSettings,
    });

    // Log full response for debugging
    console.log("BigQuery response:", {
      rows: rows,
    });

    // Extract the response with more detailed error handling
    let response = "Desculpe, não consegui processar sua solicitação.";

    if (rows && rows.length > 0) {
      const firstRow = rows[0];
      if (firstRow && "resposta_ia" in firstRow && firstRow.resposta_ia) {
        response = firstRow.resposta_ia;
      } else if (firstRow && Object.keys(firstRow).length > 0) {
        // If the response doesn't have a 'resposta_ia' field, return the first field found
        const firstKey = Object.keys(firstRow)[0];
        response = firstRow[firstKey] || response;
      }
    }

    // Log interaction (optional)
    console.log(
      `[${new Date().toISOString()}] User ${userId} asked: ${userInput}`,
    );

    return c.json({
      success: true,
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error processing chat request:", error);

    // More detailed error handling
    let errorMessage =
      "Erro ao processar sua solicitação. Por favor, tente novamente mais tarde.";
    let statusCode = 500;

    if ((error as any)?.code === "PERMISSION_DENIED") {
      errorMessage =
        "Permissão negada. Verifique as permissões da conta de serviço.";
      statusCode = 403;
    } else if ((error as any)?.code === "NOT_FOUND") {
      errorMessage =
        "Recurso não encontrado. Verifique o nome da conexão e o projeto.";
      statusCode = 404;
    }

    return c.json(
      {
        success: false,
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development"
            ? {
                message: (error as any)?.message,
                code: (error as any)?.code,
                errors: (error as any)?.errors,
              }
            : undefined,
      },
      statusCode as any,
    );
  }
});
