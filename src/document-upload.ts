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
import { getGoogleCloudConfigWithCredentials } from "./utils/google-auth.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["POST"],
  }),
);

// Configuração usando helper centralizado
const clientOptions = getGoogleCloudConfigWithCredentials();

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
