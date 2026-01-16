import { Hono } from "hono";
import { PubSub } from "@google-cloud/pubsub";
import fs from "node:fs";
import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());

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

const pubsub = new PubSub(clientOptions);

app.get("/", (c) => c.json("sanity data to pubsub"));

app.post("/", async (c) => {
  try {
    const body = await c.req.json();

    console.log("Received webhook data:", body);

    const topicNameOrId = "sanity-data-clayer";

    if (!projectId || !topicNameOrId) {
      console.error(
        "GCP_PROJECT_ID and PUBSUB_TOPIC_ID environment variables must be set.",
      );
      return c.text("Error: Missing GCP project ID or Pub/Sub topic ID", 500);
    }

    const topic = pubsub.topic(topicNameOrId);

    const dataBuffer = Buffer.from(JSON.stringify(body), "utf-8");

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

app.get("/:id", (c) => c.json(`get ${c.req.param("id")}`));

export default app;
