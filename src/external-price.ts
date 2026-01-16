import { Hono } from "hono";
import { cors } from "hono/cors";
import { Engine, type Event } from "json-rules-engine";

// @ts-ignore
/*
import { chamarGemini, gerarPromptParaGemini } from "./utils/chamarGemini.js";
*/

import Rules from "./rules/rules.json" with { type: "json" };

const app = new Hono();
app.use("*", cors());

app.use(
  "external-price",
  cors({
    origin: "http://localhost:5173", // Permitir requisições da sua aplicação React
    allowMethods: ["GET", "POST", "OPTIONS"], // Especificar métodos permitidos, incluir OPTIONS
    allowHeaders: ["Content-Type", "Authorization"], // Especificar cabeçalhos permitidos
    // maxAge: 86400, // Opcional: Quanto tempo a resposta preflight pode ser armazenada em cache (em segundos)
  }),
);

app.get("/", (c) => {
  console.log(c.req.param());
  return c.json({
    success: true,
    data: {},
  });
});

app.post("/", async (c) => {
  const bookingData = await c.req.json();

  // Isto é necessário devido ao último passo (pagamento). Como está configurado para que o external_price
  // venha sempre para aqui, mas imediatamente retorna o preço sem cálculos.
  // Cálculos feitos anteriormente.
  if (bookingData?.data?.attributes?.metadata?.context === "buyNow") {
    return c.json({
      success: true,
      data: {
        sku_code: bookingData?.data?.attributes?.sku_code,
        unit_amount_cents:
          bookingData?.data?.attributes?.metadata?.priceAmountCents,
      },
    });
  }

  // Dados iniciais
  let preçoInicial = bookingData.step_1[0].metadata.total_amount_cents;
  let precoTotal = bookingData.step_1[0].metadata.total_amount_cents;
  let descontosAplicados: {
    name: string;
    percentage?: number;
    amount?: number;
  }[] = [];
  let taxasAplicadas: {
    name: string;
    percentage?: number;
    amount?: number;
    description?: string;
  }[] = [];
  let servicosObrigatorios: {
    name: string;
    daily_price: number;
    amount: number;
  }[] = [];
  let erroAluguer: string | null = null;

  const engine = new Engine(Rules);

  engine.on("success", async (event: Event, almanac) => {
    const { type } = event;
    let { params } = event;

    if (!params) {
      console.warn(`Evento "${type}" disparado sem parâmetros esperados.`);
      return;
    }

    // Substituir dynamic_demand_forecast se necessário
    if (
      type === "aiDynamicPrice" &&
      params.percentage === "dynamic_demand_forecast"
    ) {
      const step0 = await almanac.factValue("step_0");
      // @ts-ignore
      const dynamicValue = step0.dynamic_demand_forecast;

      // Substitui como string
      const resolvedEvent = {
        ...event,
        params: {
          ...params,
          percentage: String(dynamicValue), // 👈 força string aqui
        },
      };

      console.log(
        `Evento: ${resolvedEvent.type}, Parâmetros:`,
        resolvedEvent.params,
      );

      // Você pode continuar a usar resolvedEvent.params.percentagem como string
      return;
    }

    // Log padrão para outros eventos
    console.log(`Evento: ${type}, Parâmetros:`, params);

    switch (type) {
      case "aiDynamicPrice":
        let aipercentage = params.aipercentage;

        // 🔍 Se o valor do "percentage" for uma string dinâmica, busca no almanac
        if (aipercentage === "dynamic_demand_forecast") {
          const step0 = await almanac.factValue("step_0");
          // @ts-ignore
          aipercentage = step0.dynamic_demand_forecast;
        }

        const aisurchargeAmount =
          preçoInicial * (parseFloat(aipercentage) / 100);
        precoTotal += aisurchargeAmount;

        taxasAplicadas.push({
          name: params.name,
          percentage: aipercentage,
          amount: aisurchargeAmount,
        });
        break;

      case "applyAddressDeliveryValue":
        precoTotal += params.value;
        taxasAplicadas.push({
          name: params.name,
          percentage: params.percentage,
          amount: params.value,
        });
        break;

      case "applyWeekendPickDropValue":
        precoTotal += params.value;
        taxasAplicadas.push({
          name: params.name,
          percentage: params.percentage,
          amount: params.value,
        });
        break;

      case "applyDiscount":
        // @ts-ignore
        precoTotal -= (preçoInicial * params.percentage) / 100;
        // @ts-ignore
        descontosAplicados.push({
          name: params.name,
          percentage: params.percentage,
          amount: (preçoInicial * params.percentage) / 100,
        });
        break;
      case "usageDiscount":
        precoTotal -= (preçoInicial * params.percentage) / 100;
        descontosAplicados.push({
          name: params.name,
          percentage: params.percentage,
          amount: (preçoInicial * params.percentage) / 100,
        });
        break;

      case "applySurcharge":
        let percentage = params.percentage;

        const surchargeAmount = preçoInicial * (parseFloat(percentage) / 100);
        precoTotal += surchargeAmount;

        taxasAplicadas.push({
          name: params.name,
          percentage: percentage,
          amount: surchargeAmount,
        });
        break;

      case "applyFee":
        precoTotal += params.amount;
        taxasAplicadas.push({
          name: params.name,
          amount: params.amount,
          description: params.description,
        });
        break;

      case "addMandatoryService":
        precoTotal += params.daily_price * bookingData.duracao_aluguer_dias;
        servicosObrigatorios.push({
          name: params.name,
          daily_price: params.daily_price,
          amount: params.daily_price * bookingData.duracao_aluguer_dias,
        });
        break;

      case "blockRental":
        erroAluguer = params.reason;
        break;

      default:
        console.warn(`Evento desconhecido: ${type}`);
    }
  });

  engine.on("failure", (event, almanac) => {
    console.log("Regra falhou:", event);
  });

  let eventsOutup: Event[] = [];

  /*const prompt = gerarPromptParaGemini({
          local: bookingData?.step_0?.local || "Lisboa",
          dataInicio: bookingData?.step_0?.start_date,
          dataFim: bookingData?.step_0?.end_date,
        });*/

  /*const forecastPercentage = await chamarGemini(prompt); // Ex: devolve 20 (para +20%)
      
        // Adiciona ao contexto (facts)
        if (bookingData?.step_0) {
          bookingData.step_0.dynamic_demand_forecast = forecastPercentage;
        } else {
          // Caso step_0 não exista, cria-o ou lida com a situação
          bookingData.step_0 = { dynamic_demand_forecast: forecastPercentage };
        }*/

  async function runEngine(facts: Record<string, any> | undefined) {
    const results = await engine.run(facts);
    results.events.forEach((event) => {
      console.log(`Evento: ${event.type}, Parâmetros:`, event.params);
      eventsOutup.push(event);
    });
  }

  await runEngine(bookingData);

  return c.json({
    success: true,
    data: {
      sku_code: bookingData.step_1[0].metadata.sku_code,
      unit_amount_cents: precoTotal,
      events: eventsOutup,
      taxasAplicadas: taxasAplicadas,
      descontosAplicados: descontosAplicados,
      servicosObrigatorios: servicosObrigatorios,
    },
  });
});

app.get("/:id", (c) => c.json(`get ${c.req.param("id")}`));

export default app;
