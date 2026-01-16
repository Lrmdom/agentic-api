import { Hono } from "hono";
import { ai } from "./genkit-tools.js";
import { marketingFlow } from "./genkit-flow.js";

const app = new Hono();

app.post("/run-marketing", async (c) => {
  try {
    const body = await c.req.json();

    // ✅ No Genkit atual, corre-se o flow através da instância 'ai'
    // ou diretamente chamando a constante do flow como uma função
    const result = await marketingFlow(body.input);

    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Para que a Genkit UI continue a funcionar paralelamente
export { ai, marketingFlow };

export default app;
