import { Hono } from "hono";
import { Storage } from "@google-cloud/storage";
import { Buffer } from "node:buffer";
import * as fs from "node:fs";
import { createClient } from "@sanity/client";

import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());

const isProduction = process.env.NODE_ENV === "production";
const isCloudRun = !!process.env.K_SERVICE;

const GOOGLE_CLOUD_PROJECT_ID =
  process.env.GCP_PROJECT_ID || "avid-infinity-370500";
const GCS_BUCKET_NAME = "bizzbricks-sanity-json-data";
const credentialsPathLocal = "avid-infinity-370500-d9f7e84d26a4.txt";

let clientOptions = { projectId: GOOGLE_CLOUD_PROJECT_ID };

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

const storage = new Storage(clientOptions);

/**
 * Garante que o bucket do Google Cloud Storage existe.
 * Se não existir, tenta criá-lo.
 * @param {Storage} storage - A instância do cliente do Google Cloud Storage.
 * @param {string} bucketName - O nome do bucket.
 */
async function ensureBucketExists(storage: Storage, bucketName: string) {
  const bucket = storage.bucket(bucketName);

  // 1. Verifica se o bucket existe
  const [exists] = await bucket.exists();

  if (exists) {
    console.log(`✅ GCS Bucket '${bucketName}' já existe.`);
    return bucket;
  }

  // 2. Se o bucket não existir, tenta criá-lo
  try {
    console.log(
      `⏳ GCS Bucket '${bucketName}' não encontrado. Tentando criar...`,
    );

    // Configurações de criação:
    const options = {
      // Define a localização do bucket (Recomendado na Europa para RGPD, ajuste conforme necessário)
      location: "EUROPE-WEST1",
      storageClass: "STANDARD",
    };

    await storage.createBucket(bucketName, options);
    console.log(`🎉 GCS Bucket '${bucketName}' criado com sucesso.`);
    return storage.bucket(bucketName);
  } catch (error) {
    // Código 409 indica que o bucket já pode ter sido criado por outra thread (conflito)
    // @ts-ignore
    if (error.code === 409) {
      console.log(
        `⚠️ Bucket '${bucketName}' já existe (conflito 409 - ignorado).`,
      );
      return storage.bucket(bucketName);
    }
    // Lança o erro se for uma falha de permissão ou outro erro grave
    console.error(
      `❌ ERRO: Falha ao criar o GCS Bucket '${bucketName}'. Verifique as permissões.`,
      // @ts-ignore
      error.message,
    );
    // @ts-ignore
    throw new Error(`Failed to create bucket: ${error.message}`);
  }
}

app.post("/", async (c) => {
  try {
    console.log("Webhook received!");
    const locales = ["pt", "en", "es"];

    // 🌟 Chamada para garantir a existência do bucket antes de usá-lo 🌟
    const bucket = await ensureBucketExists(storage, GCS_BUCKET_NAME);

    for (const locale of locales) {
      // Nota: A URL do Sanity é muito longa e complexa, foi mantida inalterada
      const sanityUrl = `https://ho1tf79n.api.sanity.io/v2025-12-07/data/query/production?query=%2F%2F+QUERY%3A+Busca+a+Hierarquia+Completa+e+aninhada+com+suporte+a+internacionaliza%C3%A7%C3%A3o%0A*%5B_type+%3D%3D+%22execlogServiceGroup%22%5D+%7C+order%28order+asc%29+%7B%0A++_id%2C%0A++name%2C%0A++%0A++%2F%2F+Coalesce+para+o+%27title%27+do+Service+Group%0A++%22title%22%3A+coalesce%28%0A++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++%22Missing+title+translation%22%0A++%29%2C%0A++%0A++%2F%2F+Coalesce+para+o+%27description%27+do+Service+Group%0A++%22description%22%3A+coalesce%28%0A++++description%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++description%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++%22Missing+description+translation%22%0A++%29%2C%0A+%0A++%2F%2F+1.+ANINHAMENTO%3A+SERVI%C3%87OS+%28Refer%C3%AAncia+Inversa%29%0A++%22services%22%3A+*%5B_type+%3D%3D+%22execlogService%22+%26%26+references%28%5E._id%29%5D+%7C+order%28name+asc%29+%7B%0A++++_id%2C%0A++++name%2C%0A++++sku%2C%0A++++%0A++++%2F%2F+Coalesce+para+o+%27title%27+do+Service%0A++++%22title%22%3A+coalesce%28%0A++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++%22Missing+title+translation%22%0A++++%29%2C%0A++++%0A++++%2F%2F+2.1.+Detalhes+de+Servi%C3%A7o%0A++++%22details%22%3A+*%5B_type+%3D%3D+%22execlogServiceDetail%22+%26%26+references%28%5E._id%29%5D+%7B%0A++++++_id%2C%0A++++++name%2C%0A++++++%0A++++++%2F%2F+Coalesce+para+o+%27title%27+do+Service+Detail%0A++++++%22title%22%3A+coalesce%28%0A++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++%22Missing+title+translation%22%0A++++++%29%2C%0A++++++%2F%2F+...+campos+do+ServiceDetail%0A++++%7D%2C%0A++++%0A++++%2F%2F+2.2.+Necessidades+do+Cliente+%28APENAS+o+documento+PAI%3A+execlogCustomerNeed%29%0A++++%22customerNeeds%22%3A+*%5B_type+%3D%3D+%22execlogCustomerNeed%22+%26%26+references%28%5E._id%29%5D+%7B%0A++++++_id%2C%0A++++++name%2C%0A++++++%0A++++++%2F%2F+Coalesce+para+o+%27title%27+do+Customer+Need%0A++++++%22title%22%3A+coalesce%28%0A++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++%22Missing+title+translation%22%0A++++++%29%2C%0A++++++%0A++++++%2F%2F+Coalesce+para+o+%27excerpt%27+do+Customer+Need%0A++++++%22excerpt%22%3A+coalesce%28%0A++++++++excerpt%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++excerpt%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++%22Missing+excerpt+translation%22%0A++++++%29%2C%0A++++++%2F%2F+...+outros+campos+de+CustomerNeed%0A++++++%0A++++++%2F%2F+3.+ANINHAMENTO%3A+DETALHES+DA+NECESSIDADE+%28Refer%C3%AAncia+Inversa+a+partir+da+Need%29%0A++++++%22details%22%3A+*%5B_type+%3D%3D+%22execlogCustomerNeedDetail%22+%26%26+references%28%5E._id%29%5D+%7B%0A++++++++_id%2C%0A++++++++name%2C%0A++++++++%0A++++++++%2F%2F+Coalesce+para+o+%27title%27+do+Customer+Need+Detail%0A++++++++%22title%22%3A+coalesce%28%0A++++++++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++++++%22Missing+title+translation%22%0A++++++++%29%2C%0A++++++++%2F%2F+...+campos+do+CustomerNeedDetail%0A++++++%7D%2C%0A++++%7D%2C%0A++++%0A++++%2F%2F+2.3.+Pre%C3%A7os%0A++++%22prices%22%3A+execlogServicePrice%5B%5D-%3E%7B%0A++++++_id%2C%0A++++++price%2C%0A++++++%22priceModel%22%3A+execlogServicePriceModel.priceModel-%3E%7B+name+%7D%0A++++%7D%2C%0A%0A++%7D%0A%7D&%24locale=%22${locale}%22&perspective=published`;
      const response = await fetch(sanityUrl);
      if (!response.ok) {
        console.error(
          `Failed to fetch data from Sanity for locale ${locale}: ${response.statusText}`,
        );
        continue;
      }

      const jsonData = await response.json();
      const jsonString = JSON.stringify(jsonData.result, null, 2);

      const filename = `bizzbricks-sanity-data-${locale}.json`;

      const file = bucket.file(filename);

      await file.save(Buffer.from(jsonString), {
        metadata: {
          contentType: "application/json",
        },
        resumable: false,
      });

      console.log(
        `JSON data for locale ${locale} uploaded to gs://${GCS_BUCKET_NAME}/${filename}`,
      );
    }

    return c.json({
      message: "JSON data for all locales successfully saved to GCS",
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get("/", (c) => {
  return c.text("Hono app is running and ready for Sanity webhooks!");
});

export default app;
