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

// Ferramenta para busca em manuais (otimizada para snippets)
export const manualSearchTool = ai.defineTool(
  {
    name: "manualSearchTool",
    description: "Procura informações técnicas nos manuais Honda (retorna snippets relevantes)",
    inputSchema: z.object({
      query: z.string().describe("Pergunta técnica sobre especificações da moto"),
      model: z.string().optional().describe("Modelo da moto (PCX, Forza, SH, etc.)"),
    }),
  },
  async (input) => {
    // Simulação de busca otimizada - retorna apenas snippets
    const snippets = {
      "pressão": "PCX 125: Pressão dianteira 29 psi (2.0 bar), traseira 33 psi (2.3 bar)",
      "folga": "Forza 350: Folga do acelerador 2-6 mm",
      "óleo": "SH 125: Capacidade óleo 0.9L, tipo 10W-30",
    };
    
    const query = input.query.toLowerCase();
    for (const [key, value] of Object.entries(snippets)) {
      if (query.includes(key)) {
        return `**[FONTE: MANUAL]** ${value}`;
      }
    }
    
    return "**[FONTE: MANUAL]** Especificação não encontrada. Tente: pressão, folga, óleo";
  },
);

// Ferramenta para busca no catálogo (otimizada para snippets)
export const catalogSearchTool = ai.defineTool(
  {
    name: "catalogSearchTool",
    description: "Procura informações de vendas no catálogo Honda (retorna snippets relevantes)",
    inputSchema: z.object({
      query: z.string().describe("Pergunta sobre preço, stock ou disponibilidade"),
      model: z.string().optional().describe("Modelo da moto"),
    }),
  },
  async (input) => {
    // Simulação de busca otimizada - retorna apenas snippets
    const catalogSnippets = {
      "preço": "PCX 125: €3.590 | Forza 350: €6.290 | SH 125: €3.190",
      "stock": "PCX 125: Disponível | Forza 350: 3 unidades | SH 125: Disponível",
      "cor": "Cores disponíveis: Preto, Vermelho, Cinza, Branco",
    };
    
    const query = input.query.toLowerCase();
    for (const [key, value] of Object.entries(catalogSnippets)) {
      if (query.includes(key)) {
        return `**[FONTE: CATÁLOGO]** ${value}`;
      }
    }
    
    return "**[FONTE: CATÁLOGO]** Informação não encontrada. Tente: preço, stock, cor";
  },
);
