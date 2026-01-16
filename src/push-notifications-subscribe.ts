import { Hono } from "hono";
import webpush from "web-push";
import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());

const VAPID_PUBLIC_KEY = process.env.PUSH_NOTIFICATIONS_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.PUSH_NOTIFICATIONS_PRIVATE_KEY;

// Only set VAPID details if keys are available
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:teu-email@exemplo.com",
    // @ts-ignore
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
}

let subscriptions: any[] = [];

// Função auxiliar atualizada com suporte a TAG para evitar acumulação
const broadcastNotification = async (payloadData: {
  title: string;
  body: string;
  url: string;
  tag?: string; // Tag opcional
}) => {
  const payload = JSON.stringify({
    title: payloadData.title,
    body: payloadData.body,
    url: payloadData.url,
    // A 'tag' identifica a notificação. Mesma tag = substitui a anterior.
    tag: payloadData.tag || "app-notification-group",
    // Renotify faz o telemóvel vibrar/alertar mesmo que esteja a substituir uma anterior
    renotify: true,
  });

  const notifications = subscriptions.map((sub) =>
    webpush.sendNotification(sub, payload).catch((err) => {
      if (err.statusCode === 410) {
        // Exemplo: subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
        console.log("Removendo subscrição expirada.");
      }
      console.error("Erro ao enviar:", err);
    }),
  );
  subscriptions = [];
  return Promise.all(notifications);
};

// 1. Endpoint de Subscrição
app.post("/", async (c) => {
  const subscription = await c.req.json();
  subscriptions.push(subscription);

  await broadcastNotification({
    title: "Notificações Ativadas!",
    body: "Esta mensagem substitui a anterior se enviada novamente.",
    url: "/welcome",
    tag: "welcome-message", // Tag específica para boas-vindas
  });
  return c.json({ success: true }, 201);
});

// 2. Endpoint para disparar notificações gerais
app.post("/send-notification", async (c) => {
  const { title, message, url, tag } = await c.req.json();

  await broadcastNotification({
    title,
    body: message,
    url: url || "/",
    tag: tag || "general-broadcast", // Se não enviares tag, usa uma padrão
  });

  return c.json({ message: "Enviadas!" });
});

export default app;
