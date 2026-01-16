import { Hono } from "hono";
import { cors } from "hono/cors";
import { BigQuery } from "@google-cloud/bigquery";
import {
  checkSkuAvailabilityDetailed,
  type DetailedAvailabilityResult,
} from "./bookingAvailability.js";
import * as fs from "node:fs";

const app = new Hono();

app.use("*", cors());

app.use(
  "/availability-check",
  cors({
    origin: "http://localhost:5173",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
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

const bigquery = new BigQuery(clientOptions);

app.get("/", async (c) => {
  const skuCodeToTest = c.req.query("vehicleGroupList");
  const desiredStartDate = c.req.query("start_Date");
  const desiredEndDate = c.req.query("end_Date");

  if (!desiredStartDate || !desiredEndDate) {
    return c.json(
      { error: "Missing required date parameters (start_Date, end_Date)" },
      400,
    );
  }

  console.log(
    `Checking availability for SKU: "${skuCodeToTest}" from ${desiredStartDate} to ${desiredEndDate}`,
  );

  try {
    const detailedAvailability = await checkSkuAvailabilityDetailed(
      skuCodeToTest,
      desiredStartDate,
      desiredEndDate,
      bigquery,
    );

    if (detailedAvailability.length > 0) {
      console.log("\n--- Detailed Availability Results ---");
      detailedAvailability.forEach((res) => {
        console.log(
          `  Model: "${res.vehicleModel}" | Location: "${res.storeLocation}" | Available: ${res.isAvailable}`,
        );
        if (res.conflictDetails) {
          console.log(`    Reason: ${res.conflictDetails}`);
        }
      });
    } else {
      console.log(
        "No historical models/locations found for this SKU, or no relevant booking data.",
      );
    }
    return c.json(detailedAvailability, 200);
  } catch (error) {
    console.error("Application failed to check availability:", error);
    return c.json(
      { error: "Internal server error during availability check." },
      500,
    );
  }
});

app.get("/:id", (c) => c.json(`get ${c.req.param("id")}`));

export default app;
