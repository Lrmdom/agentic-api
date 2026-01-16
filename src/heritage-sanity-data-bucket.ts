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
const GCS_BUCKET_NAME = "heritage-sanity-json-data";
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
      const sanityUrl = `https://acaezt04.api.sanity.io/v2025-12-20/data/query/production?query=*%5B_type+%3D%3D+%22bemCultural%22%5D+%7B%0A++_id%2C%0A+++%22title%22%3A+coalesce%28%0A++++title%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++title%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++%22Missing+translation%22%0A++%29%2C%0A++codigoInventario%2C%0A++%22descricao%22%3A+coalesce%28%0A++++descricao%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++descricao%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++%22Missing+translation%22%0A++%29%2C%0A++coordenadas%2C+%2F%2F+latitude+e+longitude%0A++endereco%2C++++%2F%2F+Endere%C3%A7o+autopreenchido%0A%22audioNarracao%22%3A+featuredAudio.asset-%3E+%7B%0A++%22contentType%22%3A+contentType%2C%0A++%22size%22%3A+fileSize%2C%0A++%2F%2F+O+%27fileKey%27+%C3%A9+o+nome+do+ficheiro+que+o+teu+Worker+precisa+%28ex%3A+%22audio.mp3%22%29%0A++%22url%22%3A+%22https%3A%2F%2Fsanity-r2-worker.lmatiasdomingos.workers.dev%2F%22+%2B+cloudflareR2.fileKey%2C%0A++%22fileKey%22%3A+cloudflareR2.fileKey%0A%7D%2C%0A%0A++%2F%2F+----------------------------------------------------%0A++%2F%2F+1.+RELA%C3%87%C3%95ES+1%3AN+e+N%3AM+%28Documentos+de+Lookup%29%0A++%2F%2F+Desdobra+a+refer%C3%AAncia+e+obt%C3%A9m+o+campo+%27titulo%27%0A++%2F%2F+----------------------------------------------------%0A++%0A++%2F%2F+Tipo+de+Patrim%C3%B3nio+%281%3AN%29%0A++%22tipo%22%3A+tipo-%3E%7B%0A++++%22titulo%22%3A+coalesce%28%0A++++titulo%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++titulo%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++%22Missing+translation%22%0A++%29%2C%0A++++_id%0A++%7D%2C%0A++%0A++%2F%2F+N%C3%ADvel+de+Prote%C3%A7%C3%A3o%2FClassifica%C3%A7%C3%A3o+%281%3AN%29%0A++%22classificacao%22%3A+nivelProtecao-%3E%7B%0A++++%22titulo%22%3A+coalesce%28%0A++++++titulo%5B_key+%3D%3D+%24locale%5D%5B0%5D.value%2C%0A++++++titulo%5B_key+%3D%3D+%27pt%27%5D%5B0%5D.value%2C%0A++++++titulo%0A++++%29%2C%0A++++_id%0A++%7D%2C%0A++%0A++%2F%2F+Localiza%C3%A7%C3%A3o+Administrativa+%281%3AN%29%0A++%22localizacao%22%3A+localizacaoPatrimonio-%3E%7B%0A++++nome%2C%0A++++_id%0A++%7D%2C%0A%0A++%2F%2F+Intervenientes+%28N%3AM+-+Lista+de+Autores%2FCriadores%2Fetc.%29%0A++%22intervenientes%22%3A+intervenientes%5B%5D-%3E%7B%0A++++nomeCompleto%2C%0A++++funcao%2C%0A++++_id%0A++%7D%2C%0A%0A++%2F%2F+Contextos+Hist%C3%B3ricos+%28N%3AM%29%0A++%22contextos%22%3A+contextos%5B%5D-%3E%7B%0A++++titulo%2C%0A++++periodoInicio%2C%0A++++periodoFim%2C%0A++++_id%0A++%7D%2C%0A%0A++%2F%2F+Fontes+Documentais+%28N%3AM%29%0A++%22fontes%22%3A+fontes%5B%5D-%3E%7B%0A++++titulo%2C%0A++++autor%2C%0A++++tipo%2C%0A++++dataPublicacao%2C%0A++++_id%0A++%7D%2C%0A++%0A++%2F%2F+----------------------------------------------------%0A++%2F%2F+2.+OBJETOS+ANINHADOS+COM+REFER%C3%8ANCIAS+INTERNAS%0A++%2F%2F+----------------------------------------------------%0A%0A++%2F%2F+Bens+Relacionados+%28Array+de+Objetos+Aninhados%29%0A++bensRelacionados%5B%5D+%7B%0A++++_key%2C%0A++++tipoRelacao%2C%0A++++notasRelacao%2C%0A++++%0A++++%2F%2F+Desdobrar+a+refer%C3%AAncia+ao+BEM+CULTURAL+RELACIONADO%0A++++%22bemRelacionado%22%3A+bemRelacionado-%3E%7B%0A++++++designacao%2C%0A++++++codigoInventario%2C%0A++++++_id%0A++++%7D%0A++%7D%2C%0A%0A++%2F%2F+Hist%C3%B3rico+de+Interven%C3%A7%C3%B5es+%28Array+de+Objetos+Aninhados%29%0A++intervencoes%5B%5D+%7B%0A++++_key%2C%0A++++data%2C%0A++++descricao%2C%0A++++%0A++++%2F%2F+Desdobrar+a+refer%C3%AAncia+ao+INTERVENIENTE+RESPONS%C3%81VEL%0A++++%22responsavel%22%3A+responsavel-%3E%7B%0A++++++nomeCompleto%2C%0A++++++_id%0A++++%7D%0A++%7D%2C%0A%0A++%2F%2F+----------------------------------------------------%0A++%2F%2F+3.+MEDIA+%28Se+for+um+array+de+imagem%2Ffile%29%0A++%2F%2F+----------------------------------------------------%0A+%0A++++galeria%5B%5D+%7B%0A++_key%2C%0A++caption%2C%0A++%2F%2F+Aqui+est%C3%A1+o+segredo%3A+aceder+ao+campo+%27ficheiro%27%0A++%22url%22%3A+ficheiro.asset-%3Eurl%0A%7D%2C%0A%7D&%24locale=%22${locale}%22&perspective=published`;
      const response = await fetch(sanityUrl);
      if (!response.ok) {
        console.error(
          `Failed to fetch data from Sanity for locale ${locale}: ${response.statusText}`,
        );
        continue;
      }

      const jsonData = await response.json();
      const jsonString = JSON.stringify(jsonData.result, null, 2);

      const filename = `heritage-sanity-data-${locale}.json`;

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
