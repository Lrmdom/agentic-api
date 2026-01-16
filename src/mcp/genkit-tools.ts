import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { z } from "zod";

export const ai = genkit({
  plugins: [
    googleAI(), // Ele vai buscar a GOOGLE_API_KEY ao ambiente automaticamente
  ],
});

// Define a tool aqui para garantir que ela existe antes do flow
export const ga4RealtimeTool = ai.defineTool(
  {
    name: "ga4RealtimeTool",
    description: "Obtém dados de utilizadores em Tavira",
    inputSchema: z.object({
      query: z
        .string()
        .describe("A descrição do que procurar no GA4, ex: Tavira"),
    }),
  },
  async (input) => {
    return "15 utilizadores ativos em Tavira"; // Dummy data para teste
  },
);
