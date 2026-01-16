import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());

app.post("/", async (c) => {
  try {
    const { token } = await c.req.json();
    const secret = process.env.TURNSTILE_SECRET_KEY;

    if (!secret) {
      console.error("❌ TURNSTILE_SECRET_KEY is missing!");
      return c.json({ success: false, error: "Missing secret key" }, 500);
    }

    const formData = new FormData();
    // @ts-ignore
    formData.append("secret", secret);
    formData.append("response", token);

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      },
    );

    const result = await response.json();
    console.log("🔍 Turnstile verification result:", result);

    return c.json(result);
  } catch (error) {
    console.error("❌ Turnstile verification error:", error);
    return c.json({ success: false, error: "Verification failed" }, 500);
  }
});

export default app;
