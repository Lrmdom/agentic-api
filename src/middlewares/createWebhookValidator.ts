import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createHmac } from "crypto";

// Esta é a "fábrica de middlewares".
// A função agora recebe o secret como um argumento.
export const createWebhookValidator = (secret: string) => {
  return createMiddleware(async (c, next) => {
    const signature = c.req.header("X-CommerceLayer-Signature");
    if (!signature) {
      throw new HTTPException(401, { message: "Missing signature header" });
    }

    const rawBody = await c.req.text();

    // --- Logs para depuração ---
    console.log("Secret utilizado:", secret);
    console.log("Signature recebida:", signature);

    const hmac = createHmac("sha256", secret);
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest("hex");

    console.log("Calculated Signature:", calculatedSignature);
    if (calculatedSignature !== signature) {
      throw new HTTPException(403, { message: "Invalid signature" });
    }

    try {
      const jsonBody = JSON.parse(rawBody);
      c.set("webhookBody", jsonBody);
    } catch (e) {
      throw new HTTPException(400, { message: "Invalid JSON body" });
    }

    await next();
  });
};
