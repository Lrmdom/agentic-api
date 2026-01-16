import "dotenv/config";
import { Hono } from "hono";

import * as fs from "node:fs";

import { nanoid } from "nanoid";
import { cors } from "hono/cors";

import { ImageAnnotatorClient } from "@google-cloud/vision";
import {
  processarImagemParaVisionAI,
  processarCartaConducaoFrente,
  processarCartaConducaoVerso,
  processarCertificadoMatricula,
  processarVersoCertificadoMatricula,
  processarVersoCCidOrPassport,
  processarCCidOrPassport,
} from "./utils/processDocumentUtils.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["POST"],
  }),
);

const isProduction = process.env.NODE_ENV === "production";
const isCloudRun = !!process.env.K_SERVICE;

const projectId = process.env.GCP_PROJECT_ID;

let clientOptions = { projectId };

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

const client = new ImageAnnotatorClient(clientOptions);
// @ts-ignore

app.post("/", async (c) => {
  const body = await c.req.parseBody();

  const files = Object.entries(body).filter(
    ([, value]) => value instanceof File,
  ) as [string, File][];

  if (files.length === 0) {
    return c.json({ error: "Nenhum ficheiro enviado" }, 400);
  }

  const allResults = [];

  for (const [, file] of files) {
    let detectedText;

    const buffer = Buffer.from(await file.arrayBuffer());

    const originalImageProperties = await client.imageProperties({
      image: { content: buffer },
    });

    const processedImage = await processarImagemParaVisionAI(
      buffer,
      originalImageProperties,
    );

    const [result] = await client.annotateImage({
      image: { content: processedImage },
      features: [
        {
          type: "DOCUMENT_TEXT_DETECTION",
        },
      ],
    });

    // @ts-ignore
    const detectedLocale = result.textAnnotations?.[0]?.locale;
    const detections = result.fullTextAnnotation;
    detectedText =
      detections && detections.text
        ? detections.text
        : "Nenhum texto encontrado.";

    let extractedData = {};

    const key = Object.keys(body)[0];
    if (key === "carta-frente") {
      extractedData = processarCartaConducaoFrente(detectedText);
    } else if (key === "carta-verso") {
      extractedData = processarCartaConducaoVerso(detectedText);
    }
    if (key === "dua-frente") {
      extractedData = processarCertificadoMatricula(detectedText);
    } else if (key === "dua-verso") {
      extractedData = processarVersoCertificadoMatricula(detectedText);
    }
    if (key === "cc-frente") {
      extractedData = processarCCidOrPassport(detectedText);
    } else if (key === "cc-verso") {
      extractedData = processarVersoCCidOrPassport(detectedText);
    }

    const newUploadData = {
      uploadId: nanoid(),
      filename: file.name,
      extractedData: extractedData,
      detectedText: detectedText,
      timestamp: new Date().toISOString(),
    };

    allResults.push(newUploadData);
  }

  return c.json({ success: true, uploads: allResults });
});

export default app;
