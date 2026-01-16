import { Hono } from "hono";
import { cors } from "hono/cors";

import myData from "./rules/insuranceRules.json" with { type: "json" };
// @ts-ignore
const rulesData = myData.rules;
const seguradorasData = myData.seguradoras;

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["POST"],
  }),
);

function calculateBasePrice(
  cobertura: string,
  facts: any,
  parametrosCobertura: {
    probabilidade: number;
    custoMedio: number;
    despesas: number;
    margem: number;
  },
): number {
  if (!parametrosCobertura) {
    throw new Error(`Parâmetros não definidos para a cobertura "${cobertura}"`);
  }

  let { probabilidade, custoMedio, despesas, margem } = parametrosCobertura;

  // 1️⃣ Cálculo do custo esperado
  const custoEsperado = probabilidade * custoMedio;

  // 2️⃣ Despesas operacionais
  const despesasOperacionais = custoEsperado * despesas;

  // 3️⃣ Margem de lucro
  const margemLucro = (custoEsperado + despesasOperacionais) * margem;

  // 4️⃣ Preço base final
  const precoBase = custoEsperado + despesasOperacionais + margemLucro;

  return Number(precoBase.toFixed(2));
}

/**
 * Calculates the fractioned price based on the final annual price and payment frequency.
 * Returns 0 for annual payments if there is no special rate.
 * @param precoAnual The final annual price of the insurance.
 * @param frequencia The desired payment frequency ('monthly', 'quarterly', 'semiannual' or 'annual').
 * @returns The value of the fractioned payment.
 */
function calculateFractionedPrice(
  precoAnual: number,
  frequencia: "mensal" | "trimestral" | "semestral" | "anual",
): number {
  let numPagamentos = 1;
  // Example fractionation rates. Ideally, these would be from an external source (e.g., rules.json).
  let taxaFracionamento = 0;

  switch (frequencia) {
    case "mensal":
      numPagamentos = 12;
      taxaFracionamento = 0.2; // 9% fee
      break;
    case "trimestral":
      numPagamentos = 4;
      taxaFracionamento = 0.15; // 6% fee
      break;
    case "semestral":
      numPagamentos = 2;
      taxaFracionamento = 0.1; // 4% fee
      break;
    case "anual":
      // Annual payment has no fractionation fee, so it's the annual price divided by 1.
      numPagamentos = 1;
      taxaFracionamento = 0;
      break;
    default:
      throw new Error("Invalid payment frequency.");
  }

  const precoFracionado =
    (precoAnual / numPagamentos) * (1 + taxaFracionamento);

  // Round to two decimal places
  return Number(precoFracionado.toFixed(2));
}

// Function to apply business rules
function applyRules(
  rules: any[],
  basePrice: number,
  facts: any,
  insurerSpecificParams: any,
): { precoFinal: number; detalhesCalculo: any[] } {
  let precoFinal = basePrice;
  const detalhesCalculo: any[] = [];

  for (const rule of rules) {
    let conditionsMet = false;

    // Logic for 'all' conditions
    if (rule.conditions.all) {
      conditionsMet = rule.conditions.all.every((condition: any) => {
        const fullPath = condition.fact
          ? `$.${condition.fact}${condition.path.replace(/^\$/, "")}`
          : condition.path;

        const factValue = getValueByPath(facts, fullPath);

        switch (condition.operator) {
          case "lessThan":
            return factValue < condition.value;
          case "greaterThan":
            return factValue > condition.value;
          case "lessThanInclusive":
            return factValue <= condition.value;
          case "equal":
            return factValue === condition.value;
          case "in":
            return (
              Array.isArray(factValue) &&
              condition.value.some((v: any) => factValue.includes(v))
            );
          case "contains":
            return (
              Array.isArray(factValue) && factValue.includes(condition.value)
            );
          default:
            return false;
        }
      });
    }

    // Logic for 'any' conditions
    if (rule.conditions.any) {
      conditionsMet = rule.conditions.any.some((condition: any) => {
        const fullPath = condition.fact
          ? `$.${condition.fact}${condition.path.replace(/^\$/, "")}`
          : condition.path;

        const factValue = getValueByPath(facts, fullPath);

        switch (condition.operator) {
          case "lessThan":
            return factValue < condition.value;
          case "greaterThan":
            return factValue > condition.value;
          case "equal":
            return factValue === condition.value;
          case "contains":
            return (
              Array.isArray(factValue) && factValue.includes(condition.value)
            );
          case "in":
            return (
              Array.isArray(factValue) &&
              condition.value.some((v: any) => factValue.includes(v))
            );
          default:
            return false;
        }
      });
    }

    // If the rule applies, calculate the adjustment and add to details
    if (conditionsMet) {
      const params = insurerSpecificParams[rule.name];
      if (params) {
        const percentage = parseFloat(params.percentage);
        const ajuste = basePrice * (percentage / 100);
        precoFinal += ajuste;

        detalhesCalculo.push({
          nome: params.name,
          tipo: rule.event.type === "applyDiscount" ? "Desconto" : "Sobretaxa",
          percentagem: percentage,
          valor_ajuste_euros: Number(ajuste.toFixed(2)),
        });
      }
    }
  }

  return { precoFinal, detalhesCalculo };
}

// Utility function to get a value from a nested object
function getValueByPath(obj: any, path: string): any {
  if (!path || !obj) return undefined;

  const cleanPath = path.startsWith("$.")
    ? path.slice(2)
    : path.replace(/^\$/, "");
  const parts = cleanPath.split(".");

  let current = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

// Route to simulate and compare premiums for all insurers
app.post("/", async (c) => {
  // Declare the variable outside the try block to ensure it's always in scope
  let regrasAplicaveis;

  try {
    const { tipo_seguro, cobertura, fatos_cliente } = await c.req.json();

    if (!tipo_seguro || !cobertura || !fatos_cliente) {
      return c.json(
        {
          success: false,
          error:
            "Dados de entrada incompletos: tipo_seguro, cobertura ou fatos_cliente estão ausentes.",
        },
        400,
      );
    }

    // @ts-ignore
    regrasAplicaveis = rulesData[tipo_seguro];
    if (!regrasAplicaveis) {
      return c.json(
        {
          success: false,
          error: `Regras não definidas para o tipo de seguro "${tipo_seguro}".`,
        },
        404,
      );
    }

    const resultados = [];
    const todasSeguradoras = {
      ...seguradorasData.tradicionais,
      ...seguradorasData.online,
    };

    // Defines all payment frequencies to be calculated
    const allFrequencies = ["anual", "semestral", "trimestral", "mensal"];

    // Build facts
    let facts = {};
    switch (tipo_seguro) {
      case "saude":
        facts = {
          cliente: {
            idade: fatos_cliente.segurado.idade,
            fumador: fatos_cliente.segurado.fumador,
          },
          saude: {
            historico: {
              doencas_preexistentes: fatos_cliente.segurado.historico_medico,
            },
          },
          seguro: {
            tipo_plano:
              fatos_cliente.plano.numero_membros > 1
                ? "familiar"
                : "individual",
          },
        };
        break;
      default:
        facts = fatos_cliente;
    }

    for (const seguradora in todasSeguradoras) {
      // @ts-ignore
      const seguroInfo = todasSeguradoras[seguradora][tipo_seguro];
      // @ts-ignore
      const logo_url = todasSeguradoras[seguradora]["logo_url"];

      if (!seguroInfo) continue;

      const nivelCobertura = seguroInfo.cobertura_niveis.find(
        (level: any) => level.nome === cobertura,
      );

      if (!nivelCobertura) {
        continue;
      }

      let precoBase: number;

      if (typeof nivelCobertura.preco_base_euros === "number") {
        precoBase = nivelCobertura.preco_base_euros;
      } else if (nivelCobertura.preco_base_euros === true) {
        const parametrosCobertura = nivelCobertura.parametros_cobertura;
        if (!parametrosCobertura) {
          console.error(
            `Parâmetros de cobertura ausentes para "${cobertura}" na seguradora "${seguradora}".`,
          );
          continue;
        }
        precoBase = calculateBasePrice(cobertura, facts, parametrosCobertura);
      } else {
        console.error(
          `Configuração inválida para 'preco_base_euros' na cobertura "${cobertura}" da seguradora "${seguradora}".`,
        );
        continue;
      }

      const insurerSpecificParams =
        // @ts-ignore
        todasSeguradoras[seguradora].parametros_rules;

      const { precoFinal, detalhesCalculo } = applyRules(
        regrasAplicaveis,
        // @ts-ignore
        precoBase,
        facts,
        insurerSpecificParams,
      );

      // Calculates the fractioned prices for each frequency, for all available frequencies
      const precosPorFrequencia: { [key: string]: number } = {};
      for (const freq of allFrequencies) {
        try {
          precosPorFrequencia[freq] = calculateFractionedPrice(
            precoFinal,
            freq as any,
          );
        } catch (e) {
          console.error(
            `Erro ao calcular preço para a frequência "${freq}":`,
            e,
          );
        }
      }

      resultados.push({
        logo_url,
        seguradora,
        tipo_seguro,
        cobertura,
        // @ts-ignore
        preco_base_euros: Number(precoBase.toFixed(2)),
        preco_final_euros: Number(precoFinal.toFixed(2)),
        detalhes_calculo: detalhesCalculo,
        precos_por_frequencia: precosPorFrequencia,
      });
    }
    //ordenado aleatoriamente
    //resultados.sort(() => Math.random() - 0.5);

    return c.json({
      success: true,
      data: resultados,
    });
  } catch (error) {
    console.error("Erro no cálculo do prémio:", error);
    // @ts-ignore
    return c.json(
      {
        success: false,
        // @ts-ignore
        error: `Ocorreu um erro no servidor. Detalhes: ${error.message}`,
      },
      500,
    );
  }
});

export default app;
