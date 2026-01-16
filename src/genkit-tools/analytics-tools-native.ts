// src/genkit-tools/analytics-tools-native.ts
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import fs from "fs";

let analyticsClient: BetaAnalyticsDataClient;

// Envolvemos a inicialização num try/catch para evitar crash no import
try {
  const getClientConfig = () => {
    // Em produção, usa Workload Identity diretamente
    const isProduction = process.env.NODE_ENV === 'production' || process.env.K_SERVICE || process.env.K_REVISION;
    
    if (isProduction) {
      console.log("☁️ Produção: Usando Workload Identity.");
      return {};
    }

    // Em desenvolvimento, tenta usar variável de ambiente ou arquivo local
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS };
    }

    const localKeyPath = "./avid-infinity-370500-d9f7e84d26a4.json";
    
    // Se o ficheiro local existir, usa-o
    if (fs.existsSync(localKeyPath)) {
      console.log("💻 Dev: Ficheiro encontrado. Usando chave local.");
      return { keyFilename: localKeyPath };
    }

    // Fallback para Workload Identity
    console.log("⚠️ Nenhuma credencial encontrada. Usando Workload Identity.");
    return {};
  };

  analyticsClient = new BetaAnalyticsDataClient(getClientConfig());
  console.log("✅ Cliente do Analytics inicializado com sucesso.");
} catch (e: any) {
  console.error("❌ Falha crítica ao inicializar Analytics Client:", e.message);
}

const propertyId = process.env.GA4_PROPERTY_ID || "511766107";

// Ferramenta para relatório em tempo real
export async function analyticsRealtime(input: {
  limit?: number;
}) {
  const limit = input.limit || 10;
  
  // @ts-ignore
  if (!analyticsClient) {
    return {
      error: "O cliente do Analytics não foi inicializado corretamente.",
    };
  }

  try {
    const [response] = await analyticsClient.runRealtimeReport({
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

// Ferramenta para relatório histórico
export async function analyticsReport(input: {
  days?: number;
  limit?: number;
}) {
  const days = input.days || 7;
  const limit = input.limit || 5;
  
  try {
    console.log(`📊 Consultando Relatório Histórico (${days} dias)`);

    // @ts-ignore
    const [response] = await analyticsClient.runReport({
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

// Ferramenta para métricas personalizadas
export async function analyticsCustomMetrics(input: {
  dimensions?: string[];
  metrics?: string[];
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const dimensions = input.dimensions || ["pagePath"];
  const metrics = input.metrics || ["activeUsers"];
  const startDate = input.startDate || "7daysAgo";
  const endDate = input.endDate || "today";
  const limit = input.limit || 10;

  try {
    // @ts-ignore
    const [response] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: dimensions.map(name => ({ name })),
      metrics: metrics.map(name => ({ name })),
      limit: limit,
    });

    if (!response.rows || response.rows.length === 0) {
      return { msg: "Sem dados para o período selecionado." };
    }

    return response.rows.map((row) => {
      const result: any = {};
      
      // Adicionar dimensões
      dimensions.forEach((dim, index) => {
        result[dim] = row.dimensionValues?.[index]?.value;
      });
      
      // Adicionar métricas
      metrics.forEach((metric, index) => {
        result[metric] = row.metricValues?.[index]?.value;
      });
      
      return result;
    });
  } catch (error: any) {
    console.error("❌ Erro na API Google Analytics Custom Metrics:", error.message);
    return {
      error: `Erro ao aceder às métricas personalizadas: ${error.message}`,
    };
  }
}

// Exportar todas as ferramentas
export const analyticsTools = {
  analyticsRealtime,
  analyticsReport,
  analyticsCustomMetrics,
};
