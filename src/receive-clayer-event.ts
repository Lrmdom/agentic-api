import { Hono } from "hono";
import { PubSub } from "@google-cloud/pubsub";
import { BigQuery } from "@google-cloud/bigquery";
import { z } from "zod";
// @ts-ignore
import {
  transformOrderData,
  prepareDataForBigQuery,
} from "./clayerEventsTransformer.js";
import { cors } from "hono/cors";
import { createWebhookValidator } from "./middlewares/createWebhookValidator.js";
import fs from "node:fs";

// @ts-ignore
const BQ_LOCATION = process.env.GOOGLE_BIGQUERY_LOCATION;

const WEBHOOK_SECRET = process.env.CL_ORDER_APROOVE_SECRET;
// @ts-ignore
//const webhookValidator = createWebhookValidator(WEBHOOK_SECRET);

const app = new Hono();

//app.use(webhookValidator);

app.use("*", cors());

app.use(
  "receive-clayer-event",
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

const credentialsPathLocal = "avid-infinity-370500-d9f7e84d26a4.json";

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
    console.warn(
      `AVISO: Falha ao carregar credenciais locais. Usando Application Default Credentials (gcloud auth login).`,
    );
  }
}

// Inicializa os clientes BigQuery e PubSub globalmente
const bigquery = new BigQuery(clientOptions);
const pubsub = new PubSub(clientOptions);

// @ts-ignore
app.get("/", async (c) => {
  const query = `SELECT * FROM avid-infinity-370500.events_data_dataset.events-data-table LIMIT 1000`;

  const options = {
    query: query,
    location: BQ_LOCATION,
  };

  try {
    // @ts-ignore
    const [job] = await bigquery.createQueryJob(options);
    console.log(`Job ${job.id} started.`);

    const [rows] = await job.getQueryResults();

    console.log("Query results:");

    return JSON.stringify(rows);
  } catch (error) {
    console.error("Error running query:", error);
    throw error;
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();

    const sourceFormHeader = c.req.header("X-Source-Form");

    let transformedBody = { ...body };

    if (sourceFormHeader === "manualordering") {
      transformedBody = prepareDataForBigQuery(body);
    } else {
      console.log("Request not from manualordering form. Transforming body.");
      transformedBody = transformOrderData(body);
    }

    console.log("Received webhook data:", body);

    const topicNameOrId = "eventsData";

    if (!projectId || !topicNameOrId) {
      console.error(
        "GCP_PROJECT_ID and PUBSUB_TOPIC_ID environment variables must be set.",
      );
      return c.text("Error: Missing GCP project ID or Pub/Sub topic ID", 500);
    }

    const topic = pubsub.topic(topicNameOrId);

    const dataBuffer = Buffer.from(JSON.stringify(transformedBody), "utf-8");

    const messageId = await topic.publishMessage({ data: dataBuffer });
    console.log(`Published message ID: ${messageId}`);

    return c.json({
      message: "Data received and published to Pub/Sub",
      messageId,
    });
  } catch (error) {
    console.error("Error processing webhook or publishing to Pub/Sub:", error);
    return c.text("Error processing webhook request", 500);
  }
});

export default app;
