import dotenv from "dotenv";

dotenv.config();

/**
 * Chama a API do Google Gemini para prever a procura de aluguer de motas.
 * A resposta é um número inteiro entre 0 e 30.
 *
 * @param {string} prompt - A pergunta ou contexto para a previsão.
 * @returns {Promise<number>} - Um número inteiro entre 0 e 30.
 */
export async function chamarGemini(prompt) {
  try {
    const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const chatHistory = [
      {
        role: "user",
        parts: [
          {
            text: `Responde APENAS com um número inteiro entre 0 e 30. NÃO dês explicações adicionais. Estás a prever a procura de aluguer de motas com base em eventos, tempo e tendências. A pergunta ou contexto é: ${prompt}`,
          },
        ],
      },
    ];

    const payload = {
      contents: chatHistory,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 10,
      },
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Erro na resposta da API Gemini:", errorData);
      throw new Error(
        `Erro HTTP: ${response.status} - ${JSON.stringify(errorData)}`,
      );
    }

    const result = await response.json();

    if (
      result.candidates &&
      result.candidates.length > 0 &&
      result.candidates[0].content &&
      result.candidates[0].content.parts &&
      result.candidates[0].content.parts.length > 0
    ) {
      const respostaTextual =
        result.candidates[0].content.parts[0].text?.trim() || "0";
      const percentagem = parseInt(respostaTextual, 10);

      if (isNaN(percentagem)) {
        console.warn(
          "Resposta inválida da API Gemini (não é um número):",
          respostaTextual,
        );
        return 0;
      }

      return Math.max(0, Math.min(30, percentagem));
    } else {
      console.warn("Resposta da API Gemini em formato inesperado:", result);
      return 0;
    }
  } catch (error) {
    console.error("Erro ao chamar a API Gemini:", error);
    return 0;
  }
}

/**
 * Gera o prompt para previsão de procura com base em dados fornecidos.
 *
 * @param {Object} params
 * @param {string} params.local
 * @param {string} params.dataInicio
 * @param {string} params.dataFim
 * @returns {string}
 */
export function gerarPromptParaGemini({ local, dataInicio, dataFim }) {
  return `
És um assistente de previsão de procura de aluguer de motas.
Responde apenas com um número (0 a 30) que representa o aumento percentual de procura esperado para a região de ${local} entre ${dataInicio} e ${dataFim}.

Considera:
- Eventos na região (festas, festivais, feiras, feriados)
- Previsão do tempo (dias solarengos aumentam procura)
- Fins de semana e época alta
- Tendência turística
- Se há eventos motards ou desportivos

Dá uma estimativa final de quanto o preço deve ser ajustado, em percentagem (%), de 0 a 30.
Exemplo: se achas que a procura vai ser muito alta, responde com "25". Se for normal, responde com "0". Deve ser uma string numérica e não um número.`;
}
