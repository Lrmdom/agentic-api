import { Hono, type Context } from "hono";
import { BigQuery, type QueryOptions } from "@google-cloud/bigquery";
import { cors } from "hono/cors";
import fs from "node:fs";

// --- Configuração da Aplicação ---
const DATASET_ID = "events_data_dataset";
const TABLE_ID = "events-data-table";

// Variáveis de ambiente obrigatórias
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const BQ_LOCATION = process.env.GOOGLE_BIGQUERY_LOCATION;
const isCloudRun = !!process.env.K_SERVICE;
const isProduction = process.env.NODE_ENV === "production";

// --- Configuração da Autenticação (Workload Identity / ADC) ---
let clientOptions: { projectId: string | undefined; credentials?: any } = {
  projectId: PROJECT_ID,
};
const credentialsPathLocal = "avid-infinity-370500-d9f7e84d26a4.txt";

if (isCloudRun || isProduction) {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentialsJson) {
    try {
      const credentials = JSON.parse(credentialsJson.replace(/\\n/g, "\n"));
      // @ts-ignore
      clientOptions.credentials = credentials;
      console.log(
        "Produção: Credenciais carregadas do Secret Manager (via ENV).",
      );
    } catch (e) {
      console.error(
        "ERRO: Falha ao analisar JSON da variável de credenciais. Recorrendo à Workload Identity (ADC).",
        e,
      );
    }
  } else {
    console.log(
      "Produção: Variável GOOGLE_APPLICATION_CREDENTIALS ausente. Usando Workload Identity (ADC).",
    );
  }
} else {
  try {
    const credentialsJson = fs.readFileSync(credentialsPathLocal, "utf8");
    // @ts-ignore
    clientOptions.credentials = JSON.parse(credentialsJson);
    console.log(
      `Local DEV: Credenciais carregadas do ficheiro: ${credentialsPathLocal}`,
    );
  } catch (e) {
    console.warn(
      `AVISO: Falha ao carregar credenciais locais. Usando Application Default Credentials (gcloud auth login).`,
    );
  }
}

// --- Inicialização do Cliente BigQuery ---
// Se clientOptions.credentials não estiver definido, o cliente usa ADC.
const bigquery = new BigQuery(clientOptions);

// --- Rotas Hono ---
const app = new Hono();
app.use("*", cors());

app.get("/", async (c: Context) => {
  // Garantir que o PROJECT_ID está disponível
  if (!PROJECT_ID) {
    return c.json({ error: "PROJECT_ID não definido no ambiente." }, 500);
  }

  const query = `
    SELECT
      *
    FROM
      \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
    WHERE
      PARSE_DATETIME('%Y-%m-%dT%H:%M', end_Date) > CURRENT_DATETIME('Europe/Lisbon')
  `;

  const options: QueryOptions = {
    // @ts-ignore
    query: query,
    // @ts-ignore
    location: BQ_LOCATION, // location pode ser undefined, mas BigQuery aceita se não for definido.
  };

  try {
    // 1. Cria o Job de Consulta
    const [job] = await bigquery.createQueryJob(options);
    console.log(`BigQuery Job ${job.id} started.`);

    // 2. Obtém os Resultados
    const [rows] = await job.getQueryResults();
    console.log("BigQuery Query Results fetched successfully.");

    // 3. Retorna os resultados
    return c.json(rows);
  } catch (error) {
    console.error("ERRO ao executar a consulta BigQuery:", error);
    // Em caso de falha de permissão (403) ou outro erro, retorna JSON com o erro
    return c.json(
      {
        error: "Falha ao executar a consulta BigQuery.",
        details:
          error instanceof Error
            ? error.message
            : "Erro desconhecido. Verifique os logs do IAM/Cloud Run.",
      },
      500,
    );
  }
});

app.get("/:id", (c) => c.json(`get ${c.req.param("id")}`));

export default app;
