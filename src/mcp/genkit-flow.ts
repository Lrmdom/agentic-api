import { z } from "genkit";
import { ai, ga4RealtimeTool } from "./genkit-tools.js";
export const marketingFlow = ai.defineFlow(
  {
    name: "marketingOS",
    inputSchema: z.string(),
  },
  async (userInput) => {
    const response = await ai.generate({
      // ✅ Esta é a forma mais segura: usar a referência do provider carregado
      model: "googleai/gemini-2.0-flash",
      prompt: userInput,
      tools: [ga4RealtimeTool],
    });
    return { reply: response.text };
  },
);
