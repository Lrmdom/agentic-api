import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { getGoogleCloudConfig } from "../utils/google-auth.js";

// Cliente Analytics será inicializado apenas quando necessário
let analyticsClient: BetaAnalyticsDataClient | null = null;

// Função para inicializar o cliente apenas quando necessário
function getAnalyticsClient(): BetaAnalyticsDataClient {
  if (analyticsClient) {
    return analyticsClient;
  }

  const config = getGoogleCloudConfig();
  analyticsClient = new BetaAnalyticsDataClient(config);
  console.log("✅ Cliente do Analytics inicializado com sucesso.");
  return analyticsClient;
}

const propertyId = process.env.GA4_PROPERTY_ID || "511766107";

export async function runRealtimeReport(limit = 10) {
  try {
    const client = getAnalyticsClient();
    const [response] = await client.runRealtimeReport({
      property: `properties/${propertyId}`,
      dimensions: [
        { name: "customUser:user_name" },
        { name: "customUser:brand_name" },
        { name: "customUser:u_id" },
        { name: "city" },
      ],
      metrics: [{ name: "activeUsers" }],
      limit: limit,
    });

    if (!response.rows || response.rows.length === 0) {
      return [{ status: "OK", ativos: 0, msg: "Ninguém online." }];
    }

    return response.rows.map((row: any) => ({
      Nome_do_Cliente: row.dimensionValues?.[0]?.value || "Anónimo",
      Empresa_ou_Marca: row.dimensionValues?.[1]?.value || "N/A",
      Userid: row.dimensionValues?.[2]?.value || "N/A",
      Cidade: row.dimensionValues?.[3]?.value || "N/A",
      Estado: "Ativo Agora",
    }));
  } catch (error: any) {
    console.error("❌ Erro em RealtimeReport:", error.message);
    return { error: error.message };
  }
}

export async function runAnalyticsReport(days = 7, limit = 5) {
  try {
    console.log(`📊 Consultando Relatório Histórico (${days} dias)`);

    const client = getAnalyticsClient();
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "activeUsers" }],
      limit: limit,
    });

    if (!response.rows || response.rows.length === 0) {
      return { msg: "Sem dados para o período selecionado." };
    }

    return response.rows.map((row) => ({
      pagina: row.dimensionValues?.[0]?.value,
      utilizadores: row.metricValues?.[0]?.value,
    }));
  } catch (error: any) {
    console.error("❌ Erro na API Google Analytics Report:", error.message);
    return {
      error: `Erro ao aceder ao relatório histórico: ${error.message}`,
    };
  }
}
