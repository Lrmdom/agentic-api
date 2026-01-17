import { Hono } from "hono";
import { Storage } from "@google-cloud/storage";
import { Buffer } from "node:buffer";
import * as fs from "node:fs";

import { BigQuery } from "@google-cloud/bigquery";
import { GoogleAuth } from "google-auth-library"; // Necessário para a função de backup

import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());

// Configurações do BigQuery
const BQ_DATASET = "events_data_dataset";
const BQ_TABLE = "master_catalog_rag";

const isProduction = process.env.NODE_ENV === "production";
const isCloudRun = !!process.env.K_SERVICE;

const GOOGLE_CLOUD_PROJECT_ID =
  process.env.GCP_PROJECT_ID || "avid-infinity-370500";
const GCS_BUCKET_NAME = "ridesrent-sanity-json-data";
const credentialsPathLocal = "avid-infinity-370500-d9f7e84d26a4.json";

let clientOptions = { projectId: GOOGLE_CLOUD_PROJECT_ID };

if (isCloudRun || isProduction) {
  console.log(
    "☁️ Produção: Usando Workload Identity (ADC). Nenhuma credencial explícita necessária.",
  );
  // Em produção, não usa credenciais explícitas - usa ADC do Cloud Run
} else {
  try {
    const credentialsJson = fs.readFileSync(credentialsPathLocal, "utf8");
    // @ts-ignore
    clientOptions.credentials = JSON.parse(credentialsJson);
    console.log(
      `Local DEV: Credenciais carregadas do ficheiro: ${credentialsPathLocal}`,
    );
  } catch (e) {
    console.warn(`AVISO: Falha ao carregar credenciais locais.`);
  }
}

// Usar as mesmas opções de cliente para evitar erro de arquivo JSON
const bq = new BigQuery(clientOptions);

// Manter a instância caso precises para o Gemini,
// mas usaremos a função abaixo para evitar o erro do embedModel.

// 🌟 NOVA FUNÇÃO PARA RESOLVER O ERRO "is not a function" 🌟
async function generateEmbeddings(text: string) {
  const endpoint = `https://europe-southwest1-aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/europe-southwest1/publishers/google/models/text-embedding-004:predict`;

  // @ts-ignore
  const auth = new GoogleAuth({
    credentials: (clientOptions as any).credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ content: text, task_type: "RETRIEVAL_DOCUMENT" }],
    }),
  });

  if (!response.ok)
    throw new Error(`Embedding API error: ${response.statusText}`);
  const data = await response.json();
  return data.predictions[0].embeddings.values;
}

const storage = new Storage(clientOptions);

async function ensureBucketExists(storage: Storage, bucketName: string) {
  const bucket = storage.bucket(bucketName);
  const [exists] = await bucket.exists();
  if (exists) {
    console.log(`✅ GCS Bucket '${bucketName}' já existe.`);
    return bucket;
  }
  try {
    console.log(
      `⏳ GCS Bucket '${bucketName}' não encontrado. Tentando criar...`,
    );
    const options = { location: "EUROPE-WEST1", storageClass: "STANDARD" };
    await storage.createBucket(bucketName, options);
    console.log(`🎉 GCS Bucket '${bucketName}' criado com sucesso.`);
    return storage.bucket(bucketName);
  } catch (error) {
    // @ts-ignore
    if (error.code === 409) return storage.bucket(bucketName);
    // @ts-ignore
    throw new Error(`Failed to create bucket: ${error.message}`);
  }
}

app.post("/", async (c) => {
  try {
    console.log("Webhook received!");
    const locales = ["pt", "en", "es"];
    const bucket = await ensureBucketExists(storage, GCS_BUCKET_NAME);

    for (const locale of locales) {
      const sanityUrl = `https://fv48p2bt.api.sanity.io/v2025-07-16/data/query/production?query=*%5B_type+%3D%3D+%22vehicleGroup%22%5D+%7B%0A++name%2C%0A++%22title%22%3A+coalesce%28%0A++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++%22Missing+translation%22%0A++%29%2C%0A++%22avatar%22%3A+image.asset-%3Eurl+%2B+%22%3Fauto%3Dformat%26w%3D500%22%2C%0A++locations%5B%5D-%3E%7B%0A++++%22title%22%3A+coalesce%28%0A++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++%22Missing+translation%22%0A++++%29%2C%0A++%7D%2C%0A++vehicleGroupLists%5B%5D-%3E%7B+%2F%2F+Traversing+into+referenced+vehicleGroupList+documents%0A++++%22vehicleGroupId%22%3A+%5E._id%2C+%2F%2F+%3C---+ADDED%3A+Reference+parent+vehicleGroup%27s+ID%0A++++%22vehicleGroupName%22%3A+%5E.name%2C+%2F%2F+%3C---+ADDED%3A+Reference+parent+vehicleGroup%27s+name%0A++++%22vehicleGroupTitle%22%3A+coalesce%28+%2F%2F+%3C---+ADDED%3A+Reference+parent+vehicleGroup%27s+title%0A++++++%5E.title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++%5E.title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++%22Missing+translation%22%0A++++%29%2C%0A++++%22bookingOptions%22%3A+*%5B_type%3D%3D%27VehicleGroupListOptions%27+%26%26+references%28%5E._id%29%5D+%7B++%0A++++name%2C%0A++++++price%2C%0A++++++%22title%22%3A+coalesce%28%0A++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++%22Missing+translation%22%0A++++++%29%2C%0A++++++%22vehiclegrouplistForClayerCodePurposes%22%3A+vehiclegrouplist%5B%5D-%3E%7B%0A++++++++code%2C%0A++++++++name%2C%0A++++++++%22title%22%3A+coalesce%28%0A++++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++%22Missing+translation%22%0A++++++++%29%0A++++++%7D%0A++++%7D%2C%0A++++code%2C%0A++++name%2C%0A++++%22title%22%3A+coalesce%28%0A++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++%22Missing+translation%22%0A++++%29%2C%0A++++%22avatar%22%3A+image.asset-%3Eurl+%2B+%22%3Fauto%3Dformat%26w%3D500%22%2C%0A%0A++++%22prices%22%3A+prices%5B%5D%7B%0A++++++%22name%22%3A+season-%3Ename%2C%0A++++++%22periods%22%3A+%7B%0A++++++++%22name%22%3A+season-%3Ename%2C%0A++++++++%22title%22%3A+coalesce%28%0A++++++++++season-%3Etitle%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++season-%3Etitle%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++%22Missing+translation%22%0A++++++++%29%2C%0A++++++++%22start_Date%22%3A+season-%3Estart_Date%2C%0A++++++++%22end_Date%22%3A+season-%3Eend_Date%0A++++++%7D%2C%0A++++++pricing%0A++++%7D%2C%0A%0A++++%2F%2F+---+Fetching+availableAssurancePackages+---%0A++++%22availableAssurancePackages%22%3A+availableAssurancePackages%5B%5D%7B+%2F%2F+Access+the+array+of+package+details%0A++++++price%2C%0A++++++included%2C%0A++++++%22Deposit%22%3A+Deposit%2C+%2F%2F+Project+your+%27Deposit%27+field%0A++++++excessReduction%2C+++%2F%2F+Project+your+%27excessReduction%27+field%0A++++++%22packageDetails%22%3A+package-%3E%7B+%2F%2F+Dereference+the+%27package%27+reference+to+get+its+details%0A++++++++name%2C%0A++++++++code%2C%0A++++++++%22title%22%3A+coalesce%28%0A++++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++%22Missing+translation%22%0A++++++++%29%2C%0A++++++++%22description%22%3A+coalesce%28%0A++++++++++description%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++description%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++%22Missing+translation%22%0A++++++++%29%2C%0A++++++++includedCoverages%5B%5D-%3E%7B+%2F%2F+Dereference+included+coverage+definitions%0A++++++++++name%2C%0A++++++++++%22title%22%3A+coalesce%28%0A++++++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++++%22Missing+translation%22%0A++++++++++%29%2C%0A++++++++++%22description%22%3A+coalesce%28%0A++++++++++++shortDescription%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++++shortDescription%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++++%22Missing+translation%22%0A++++++++++%29%0A++++++++%7D%2C%0A++++++++notIncludedCoverages%5B%5D-%3E%7B+%2F%2F+Dereference+excluded+coverage+definitions%0A++++++++++name%2C%0A++++++++++%22title%22%3A+coalesce%28%0A++++++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++++%22Missing+translation%22%0A++++++++++%29%2C%0A++++++++++%22description%22%3A+coalesce%28%0A++++++++++++shortDescription%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++++shortDescription%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++++%22Missing+translation%22%0A++++++++++%29%0A++++++++%7D%2C%0A++++++++isDefault%2C%0A++++++++order%2C%0A++++++%7D%0A++++%7D%2C%0A++++%2F%2F+---+End+of+availableAssurancePackages+---%0A%0A++++%22vehicleModels%22%3A+*%5B_type+%3D%3D+%22vehicleModel%22+%26%26+groupList._ref+%3D%3D+%5E._id%5D+%7B%0A++++++%22modelAcessories%22%3A+*%5B_type%3D%3D%27vehicleModelAcessoriesGroup%27+%26%26+references%28%5E._id%29%5D+%7B%0A++++++++acessorieLists%5B%5D-%3E%7B%0A++++++++++pricing%2C%0A++++++++++%22avatar%22%3A+image.asset-%3Eurl+%2B+%22%3Fauto%3Dformat%26w%3D500%22%2C%0A++++++++++%22title%22%3A+coalesce%28%0A++++++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++++%22Missing+translation%22%0A++++++++++%29%0A++++++++%7D%2C%0A++++++++name%2C%0A++++++++acessorieGroupLists-%3E%7B%0A++++++++++name%2C%0A++++++++++%22title%22%3A+coalesce%28%0A++++++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++++%22Missing+translation%22%0A++++++++++%29%0A++++++++%7D%2C%0A++++++%7D%2C%0A++++++name%2C%0A++++++modelLink%2C%0A++++++%22title%22%3A+coalesce%28%0A++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++%22Missing+translation%22%0A++++++%29%2C%0A++++++%22avatar%22%3A+image.asset-%3Eurl+%2B+%22%3Fauto%3Dformat%26w%3D500%22%2C%0A++++++vehicles%5B%5D-%3E%7B%0A++++++mileage%2C%0A++++++++%22avatar%22%3A+image.asset-%3Eurl+%2B+%22%3Fauto%3Dformat%26w%3D70%22%2C%0A++++++++name%2C%0A++++++++%22title%22%3A+coalesce%28%0A++++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++%22Missing+translation%22%0A++++++++%29%2C%0A++++++++vehicleModel-%3E%7Bname%7D%2C%0A++++++++location-%3E%7Bname%7D%2C%0A++++++++registration%2C%0A++++++%7D%2C%0A++++++vehicleGroupTypes%5B%5D-%3E%7B%0A++++++++name%2C%0A++++++++%22title%22%3A+coalesce%28%0A++++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++%22Missing+translation%22%0A++++++++%29%2C%0A++++++++%22avatar%22%3A+image.asset-%3Eurl+%2B+%22%3Fauto%3Dformat%26w%3D500%22%2C%0A++++++%7D%0A++++%7D%0A++%7D%0A%7D&%24locale=%22${locale}%22&perspective=published`;

      const response = await fetch(sanityUrl);
      if (!response.ok) continue;
      const jsonData = await response.json();
      const filename = `ridesrent-sanity-data-${locale}.json`;
      await bucket
        .file(filename)
        .save(Buffer.from(JSON.stringify(jsonData.result, null, 2)), {
          metadata: { contentType: "application/json" },
          resumable: false,
        });
      console.log(`JSON locale ${locale} uploaded.`);
    }
    return c.json({ message: "Success" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return c.json({ error: "Internal error" }, 500);
  }
});

app.post("/process-event", async (c) => {
  try {
    const locales = ["pt", "en", "es"];
    const rowsToUpsert = [];
    for (const locale of locales) {
      const fileName = `ridesrent-sanity-data-${locale}.json`;
      const [fileContent] = await storage
        .bucket(GCS_BUCKET_NAME)
        .file(fileName)
        .download();
      const categories = JSON.parse(fileContent.toString());

      for (const category of categories) {
        if (!category.vehicleGroupLists) continue;
        for (const group of category.vehicleGroupLists) {
          const skuCode =
            group.bookingOptions?.[0]
              ?.vehiclegrouplistForClayerCodePurposes?.[0]?.code || group.code;
          const finalSku =
            typeof skuCode === "object" ? skuCode?.current : skuCode;

          if (!finalSku) continue;

          let chunk = `Veículo: ${group.title}. Categoria: ${category.title}.\n`;
          if (group.availableAssurancePackages) {
            chunk +=
              "Seguros: " +
              group.availableAssurancePackages
                .map((pkg: any) => pkg.packageDetails?.title)
                .join(", ") +
              ".\n";
          }

          // 🌟 CHAMADA DA NOVA FUNÇÃO QUE RESOLVE O PROBLEMA 🌟
          const vector = await generateEmbeddings(chunk);

          rowsToUpsert.push({
            sku_code: finalSku,
            language: locale,
            title: group.title,
            rag_super_chunk: chunk,
            embedding: vector,
            content_json: JSON.stringify(group),
          });
        }
      }
    }
    if (rowsToUpsert.length > 0) {
      await upsertBigQuery(rowsToUpsert);
    }
    return c.json({ status: "success", count: rowsToUpsert.length });
  } catch (error: any) {
    console.error(error);
    return c.json({ error: error.message }, 500);
  }
});

async function upsertBigQuery(rows: any[]) {
  // 1. DEDUPLICAÇÃO E VALIDAÇÃO GLOBAL (PT, EN, ES juntos)
  const cleanRows = Object.values(
    rows.reduce(
      (acc, current) => {
        // A chave única agora é obrigatoriamente SKU + LÍNGUA
        const key = `${current.sku_code}_${current.language}`;

        const isValid =
          current.embedding &&
          current.rag_super_chunk &&
          current.title &&
          current.language; // Garantimos que a língua existe para o RAG

        if (isValid) {
          // Mantém o registo mais recente se houver duplicados no array
          if (
            !acc[key] ||
            new Date(current.last_sync) > new Date(acc[key].last_sync)
          ) {
            acc[key] = current;
          }
        }
        return acc;
      },
      {} as Record<string, any>,
    ),
  );

  if (cleanRows.length === 0) {
    console.log("Nenhum dado válido para Upsert.");
    return;
  }

  const dataset = bq.dataset(BQ_DATASET);

  // 2. STAGING UNIFICADO (Removido o suffix _{locale})
  // Usamos um nome genérico pois o array já contém todas as línguas
  const stagingTableId = `${BQ_TABLE}_staging_all_locales`;
  const mainTableFullName = `\`${GOOGLE_CLOUD_PROJECT_ID}.${BQ_DATASET}.${BQ_TABLE}\``;
  const stagingTableFullName = `\`${GOOGLE_CLOUD_PROJECT_ID}.${BQ_DATASET}.${stagingTableId}\``;

  const [tableExists] = await dataset.table(stagingTableId).exists();
  if (!tableExists) {
    const [metadata] = await dataset.table(BQ_TABLE).getMetadata();
    await dataset.createTable(stagingTableId, {
      schema: metadata.schema,
      // Expira em 1 hora para limpeza automática
      expirationTime: (Date.now() + 3600000).toString(),
    });
  }

  // Limpa o staging anterior e insere o novo bloco multi-língua
  await bq.query(`TRUNCATE TABLE ${stagingTableFullName}`);
  await dataset.table(stagingTableId).insert(cleanRows);

  // 3. MERGE MULTI-IDIOMA
  // O ON T.language = S.language é o que garante que o RAG
  // não misture as descrições da Harley em PT com as de EN.
  const query = `
    MERGE ${mainTableFullName} T
    USING (
      SELECT * FROM ${stagingTableFullName}
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY sku_code, language 
        ORDER BY last_sync DESC
      ) = 1
    ) S
    ON T.sku_code = S.sku_code AND T.language = S.language
    WHEN MATCHED THEN
      UPDATE SET 
        title = S.title,
        rag_super_chunk = S.rag_super_chunk,
        embedding = S.embedding,
        content_json = S.content_json,
        last_sync = S.last_sync
    WHEN NOT MATCHED THEN
      INSERT (sku_code, language, title, rag_super_chunk, embedding, content_json, last_sync)
      VALUES (S.sku_code, S.language, S.title, S.rag_super_chunk, S.embedding, S.content_json, S.last_sync)
  `;

  await bq.query(query);
  console.log(
    `Upsert concluído: ${cleanRows.length} linhas processadas (Multi-language).`,
  );
}
app.get("/", (c) => c.text("Hono app is running!"));

export default app;
