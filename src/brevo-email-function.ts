// Importa as regras do ficheiro JSON.
// Certifique-se de que o caminho está correto e que o ficheiro se chama "brevoRules.json".
// A sintaxe "with { type: 'json' }" é necessária para módulos ES6.
import brevoRules from "./rules/brevoRules.json" with { type: "json" };

/**
 * Uma função auxiliar para determinar o nome do template da Brevo com base
 * no estado da encomenda, estado do pagamento e nome do comerciante,
 * utilizando um motor de regras externo.
 *
 * @param {object} orderData - Os dados da encomenda, que devem conter o código de idioma, o estado, o estado do pagamento e os dados do comerciante.
 * @returns {string} O nome do template a ser utilizado.
 */
export const getTemplateNameByRules = (orderData: {
  data: {
    attributes: {
      language_code: any;
      status: any;
      payment_status: any;
      fulfillment_status: any;
    };
  };
  included: any[];
}): string => {
  const langCode = orderData.data.attributes.language_code;
  const orderStatus = orderData.data.attributes.status;
  const paymentStatus = orderData.data.attributes.payment_status;
  const fulfillmentStatus = orderData.data.attributes.fulfillment_status;
  // Encontra o objeto do comerciante no array 'included'
  const merchant = orderData.included.find((item) => item.type === "merchants");

  // Extrai o nome do comerciante com segurança
  let merchantName = "default_merchant";
  if (merchant && merchant.attributes && merchant.attributes.name) {
    merchantName = merchant.attributes.name.toLowerCase().replace(/\s/g, "_");
  }

  // Encontra a primeira regra que corresponde aos status da encomenda
  const foundRule = brevoRules.find(
    (rule) =>
      rule.conditions.orderStatus === orderStatus &&
      rule.conditions.paymentStatus === paymentStatus &&
      rule.conditions.fulfillmentStatus === fulfillmentStatus,
  );

  if (foundRule) {
    //return `${merchantName}_${langCode}_${foundRule.templateSuffix}`;
    return `${langCode}_${foundRule.templateSuffix}`;
  }

  // Fallback para um template padrão caso não encontre uma regra correspondente
  //return `${merchantName}_${langCode}_orders.default`;
  return `${langCode}_orders.default`;
};

/**
 * Envia um email através da API da Brevo, determinando o template a ser usado
 * com base no estado da encomenda.
 *
 * @param {object} orderData - O objeto de dados da encomenda.
 * @param templateName
 * @param {object} invoiceData - O objeto de dados da fatura.
 * @returns {Promise<Response>} A resposta da API de envio de email.
 */
export const sendBrevoOrderEmail = async (
  orderData: any,
  templateName: any,
  invoiceData = null,
) => {
  try {
    // @ts-ignore
    const invoiceUrl = invoiceData?.invoice; // Assumindo que a estrutura é esta

    const flatOrderData = flattenJson(orderData);

    //const templateName = getTemplateNameByRules(orderData); //dont need because pass templateName in function arguments
    const brevoApiKey = process.env.BREVO_API_KEY;
    // Passo 1: Obter o ID do template da Brevo
    console.log(`Buscando template com o nome: ${templateName}`);

    const templatesResponse = await fetch(
      `https://api.brevo.com/v3/smtp/templates?templateStatus=true&limit=50&offset=0&sort=desc`,
      {
        method: "GET",
        // @ts-ignore
        headers: {
          accept: "*/*",
          "api-key": brevoApiKey,
        },
      },
    );

    if (!templatesResponse.ok) {
      throw new Error(`Erro ao buscar templates: ${templatesResponse.status}`);
    }

    const data = await templatesResponse.json();
    const foundTemplate = data.templates.find(
      (template: { name: string }) => template.name === templateName,
    );

    if (!foundTemplate) {
      console.error(`Template '${templateName}' não encontrado.`);
      throw new Error("Template não encontrado.");
    }
    console.log(`Template encontrado com o ID: ${foundTemplate.id}`);

    // Passo 2: Enviar o email usando o ID do template encontrado
    const emailResponse = await fetch(`https://api.brevo.com/v3/smtp/email`, {
      method: "POST",
      // @ts-ignore
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Execlog-Digital Transformation services",
          email: "execlog.digital@gmail.com",
        },
        to: [
          {
            email: flatOrderData.customer_email,
            name: flatOrderData.addresses.full_name,
          },
        ],
        bcc: [
          { email: "leonel.m.domingos@gmail.com", name: "Leonel" },
          { email: "lmatiasdomingos@gmail.com", name: "Helen" },
        ],
        cc: [{ email: "execlog.digital@gmail.com", name: "Execlog" }],
        templateId: foundTemplate.id,
        subject: "Obrigado pela sua encomenda",
        replyTo: {
          email: "ann6533@example.com",
          name: "Ann",
        },
        tags: ["tag1", "tag2"],
        params: {
          name: flatOrderData.addresses.full_name,
          email: flatOrderData.customer_email,
          primeiro_nome: flatOrderData.addresses.full_name,
          orderData: flatOrderData,
          invoice: invoiceUrl?.permalink ?? null,
          // Adicione aqui outras variáveis que o seu template precise
        },
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(
        `Erro ao enviar email: ${emailResponse.status} - ${errorText}`,
      );
      throw new Error(`Erro ao enviar email: ${emailResponse.status}`);
    }

    console.log("Email enviado com sucesso!");
    return emailResponse;
  } catch (error) {
    console.error("Ocorreu um erro na função sendBrevoEmail:", error);
    // Relance o erro para que a função que chamou possa lidar com ele
    throw error;
  }
};

export function flattenJson(orderData: { data: any; included: any }) {
  const flattened = {
    ...orderData.data.attributes,
    ...orderData.data.relationships,
  };
  const lineItems: any[] = [];

  // Mapeia os dados do array 'included'
  orderData.included.forEach(
    (item: { type: string; attributes: any; id: any }) => {
      // Para line_items, cria um array dedicado para um ciclo
      if (item.type === "line_items") {
        lineItems.push({
          ...item.attributes,
          type: item.type,
        });
      } else {
        // Para os outros tipos, adiciona diretamente ao objeto principal
        // Ex: data.customer, data.billing_address, etc.
        flattened[item.type] = {
          id: item.id,
          ...item.attributes,
        };
      }
    },
  );

  // Adiciona o array de line_items ao objeto aplanado
  flattened.line_items = lineItems;

  return flattened;
}

// Exemplo de uso
const originalJson = {
  // O seu JSON completo vai aqui
  data: {
    id: "ykohGxoYzA",
    type: "orders",
    attributes: {
      number: 87503710,
      customer_email: "lmatiasdomingos@gmail.com",
      formatted_total_amount: "€581,35",
      placed_at: "2025-08-12T13:49:10.456Z",
    },
    relationships: {
      customer: {
        data: {
          type: "customers",
          id: "OAdBhxovAg",
        },
      },
      billing_address: {
        data: {
          type: "addresses",
          id: "ExAuJPqwvq",
        },
      },
      market: {
        data: {
          type: "markets",
          id: "vlkaZhkGNj",
        },
      },
    },
  },
  included: [
    {
      id: "vlkaZhkGNj",
      type: "markets",
      attributes: {
        name: "Europe",
      },
    },
    {
      id: "OAdBhxovAg",
      type: "customers",
      attributes: {
        email: "lmatiasdomingos@gmail.com",
      },
    },
    {
      id: "ExAuJPqwvq",
      type: "addresses",
      attributes: {
        first_name: "Leonel",
        last_name: "Domingos",
      },
    },
    {
      id: "YEAtEBAjOB",
      type: "line_items",
      attributes: {
        name: "Scooters 50 cc",
        quantity: 1,
        formatted_total_amount: "€581,35",
      },
    },
  ],
};

// Transforma o JSON original
const processedData = flattenJson(originalJson);