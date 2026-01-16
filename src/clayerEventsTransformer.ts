// @ts-ignore
export function transformOrderData(jsonData) {
  const data = jsonData.data || {};
  const attributes = data.attributes || {};
  const originalTopLevelMetadata = attributes.metadata || {}; // This is attributes.metadata

  let primaryLineItemAttributes = {}; // To store attributes of the line_item that has bookingData
  let fullBookingData = null; // To store the entire 'bookingData' object itself
  let lineItemBookingMetadata = {}; // To store the 'metadata' object from fullBookingData.step_1[0]

  // Iterate through 'included' array to find the line_item that contains 'bookingData'
  if (jsonData.included && jsonData.included.length > 0) {
    for (const item of jsonData.included) {
      // Check if it's a line_item AND if it has bookingData in its attributes.metadata
      if (
        item.type === "line_items" &&
        item.attributes &&
        item.attributes.metadata &&
        item.attributes.metadata.bookingData
      ) {
        primaryLineItemAttributes = item.attributes; // Store the attributes of this specific line_item
        fullBookingData = item.attributes.metadata.bookingData; // Store the entire bookingData object

        // Safely extract lineItemBookingMetadata from fullBookingData.step_1[0].metadata
        lineItemBookingMetadata = fullBookingData?.step_1?.[0]?.metadata || {};
        break; // Found the relevant line item, no need to check further
      }
    }
  }

  // Safely extract bookingDataStep0
  const bookingDataStep0 = fullBookingData?.step_0 || {};

  // @ts-ignore
  const transformedData = {
    // Direct attributes from the main order data
    id: data.id,
    numero_pedido: attributes.number,
    status: attributes.status,
    payment_status: attributes.payment_status,
    email_cliente: attributes.customer_email,
    total_cents: attributes.total_amount_cents,
    formatted_total_amount_with_taxes:
      attributes.formatted_total_amount_with_taxes,

    // sku_code: Prioritize sku_code from the relevant line_item's direct attributes,
    // then from lineItemBookingMetadata, then null.
    // @ts-ignore
    sku_code:
      // @ts-ignore
      primaryLineItemAttributes.sku_code ||
      // @ts-ignore
      lineItemBookingMetadata.sku_code ||
      null,

    moeda: attributes.currency_code,

    // mes_recolha: Prioritize bookingDataStep0, then lineItemBookingMetadata.
    // Explicitly check for undefined/null to preserve 0 if it's a valid value.

    mes_recolha:
      bookingDataStep0.mes_recolha !== undefined &&
      bookingDataStep0.mes_recolha !== null
        ? bookingDataStep0.mes_recolha
        : // @ts-ignore
          lineItemBookingMetadata.mes_recolha !== undefined &&
            // @ts-ignore
            lineItemBookingMetadata.mes_recolha !== null
          ? // @ts-ignore
            lineItemBookingMetadata.mes_recolha
          : null,

    // number_of_days: Prioritize bookingDataStep0, then lineItemBookingMetadata.
    // Explicitly check for undefined/null to preserve 0 if it's a valid value.
    number_of_days:
      bookingDataStep0.number_of_days !== undefined &&
      bookingDataStep0.number_of_days !== null
        ? bookingDataStep0.number_of_days
        : // @ts-ignore
          lineItemBookingMetadata.number_of_days !== undefined &&
            // @ts-ignore
            lineItemBookingMetadata.number_of_days !== null
          ? // @ts-ignore
            lineItemBookingMetadata.number_of_days
          : null,

    // idade_condutor: Directly from lineItemBookingMetadata. If null/undefined there, it will be null.
    // @ts-ignore
    idade_condutor: fullBookingData?.step_4?.[0]?.idade_condutor || 1,

    // conditionA, conditionB, vehicleModel: Found in lineItemBookingMetadata in your sample.
    // Use them from there, or originalTopLevelMetadata, or null.
    // @ts-ignore
    conditionA:
      // @ts-ignore
      lineItemBookingMetadata.conditionA ||
      originalTopLevelMetadata.conditionA ||
      null,
    // @ts-ignore
    conditionB:
      // @ts-ignore
      lineItemBookingMetadata.conditionB ||
      originalTopLevelMetadata.conditionB ||
      null,
    // @ts-ignore
    vehicleModel:
      // @ts-ignore
      lineItemBookingMetadata.vehicleModel ||
      originalTopLevelMetadata.vehicleModel ||
      null,

    // store_location: Prioritize bookingDataStep0.vehicleDropLocationSelect, then lineItemBookingMetadata.drop_location.
    // If both are null/undefined, it will be null.
    // @ts-ignore
    store_location:
      bookingDataStep0.vehicleDropLocationSelect ||
      // @ts-ignore
      lineItemBookingMetadata.drop_location ||
      null,

    // vehicle_registration_number: Directly from lineItemBookingMetadata. If null/undefined there, it will be null.
    // @ts-ignore
    vehicle_registration_number:
      // @ts-ignore
      lineItemBookingMetadata.vehicle_registration_number || null,

    // start_Date: Prioritize bookingDataStep0 dates (if not "All"), then lineItemBookingMetadata dates (if not "All").
    // If neither provides a non-"All" date, it will be null.
    start_Date:
      bookingDataStep0.start_Date && bookingDataStep0.start_Date !== "All"
        ? bookingDataStep0.start_Date
        : // @ts-ignore
          lineItemBookingMetadata.start_Date &&
            // @ts-ignore
            lineItemBookingMetadata.start_Date !== "All"
          ? // @ts-ignore
            lineItemBookingMetadata.start_Date
          : null,

    // end_Date: Prioritize bookingDataStep0 dates (if not "All"), then lineItemBookingMetadata dates (if not "All").
    // If neither provides a non-"All" date, it will be null.
    end_Date:
      bookingDataStep0.end_Date && bookingDataStep0.end_Date !== "All"
        ? bookingDataStep0.end_Date
        : // @ts-ignore
          lineItemBookingMetadata.end_Date &&
            // @ts-ignore
            lineItemBookingMetadata.end_Date !== "All"
          ? // @ts-ignore
            lineItemBookingMetadata.end_Date
          : null,

    // BookingData: This field holds the stringified JSON of the entire 'fullBookingData' object.
    // Ensure the field name matches your schema: "BookingData" (capital B).
    BookingData: fullBookingData ? JSON.stringify(fullBookingData) : null,
  };

  return transformedData;
}

// @ts-ignore
export function prepareDataForBigQuery(data) {
  const transformedData = { ...data }; // Cria uma cópia superficial do objeto de dados

  // --- 1. Converter campos para o tipo 'int' conforme o esquema do BigQuery ---
  const fieldsThatShouldBeInt = [
    "numero_pedido",
    "total_cents",
    "mes_recolha",
    "number_of_days",
    "idade_condutor",
    "conditionA",
    "conditionB",
  ];

  for (const field of fieldsThatShouldBeInt) {
    // Se o valor existe e não é já um número, tenta converter para inteiro.
    // Se não puder ser convertido (ex: string vazia, null, undefined), usa 0.
    if (
      transformedData[field] !== undefined &&
      transformedData[field] !== null
    ) {
      const parsedValue = parseInt(transformedData[field], 10);
      transformedData[field] = isNaN(parsedValue) ? 0 : parsedValue;
    } else {
      transformedData[field] = 0; // Se for null/undefined no input, define como 0
    }
  }

  // --- 2. Garantir que campos de data/hora estão em formato de string adequado (YYYY-MM-DDTHH:MM:SS) ---
  // O componente React já envia no formato YYYY-MM-DDTHH:MM:SS.
  // Aqui, apenas garantimos que são strings e não null/undefined.
  const dateFields = ["start_Date", "end_Date"];
  for (const field of dateFields) {
    if (typeof transformedData[field] !== "string" || !transformedData[field]) {
      transformedData[field] = ""; // Ou um valor padrão vazio ou null se o BQ permitir
    }
  }

  // --- 3. Processar e limpar o JSON dentro de BookingData ---
  // A string BookingData deve ser válida.
  // Você pode parsear para manipular se for necessário validar/ajustar conteúdo interno,
  // mas depois deve serializar de volta para string.
  if (
    transformedData.BookingData &&
    typeof transformedData.BookingData === "string"
  ) {
    try {
      let bookingDataObj = JSON.parse(transformedData.BookingData);

      // Exemplo: se houver campos que aparecem no BookingData interno mas
      // devem ser numéricos, garanta que são números aqui.
      // bookingDataObj.step_0.mes_recolha = parseInt(bookingDataObj.step_0.mes_recolha, 10);
      // bookingDataObj.step_1[0].metadata.total_amount_cents = parseInt(bookingDataObj.step_1[0].metadata.total_amount_cents, 10);
      // (O componente React já faz isso para os campos numéricos internos do BookingData,
      // então esta etapa aqui seria mais para uma validação extra ou se a fonte fosse outra).

      // Certifique-se de que os campos de cliente (firstName, lastName, telephone) estão dentro do step_4,
      // pois eles vêm do formData original.
      if (bookingDataObj.step_4) {
        if (transformedData.nome_cliente) {
          // Use o nome_cliente original do formData
          bookingDataObj.step_4.firstName =
            transformedData.nome_cliente.split(" ")[0] || "";
          bookingDataObj.step_4.lastName =
            transformedData.nome_cliente.split(" ").slice(1).join(" ") || "";
        }
        if (transformedData.contato_cliente) {
          // Use o contato_cliente original do formData
          bookingDataObj.step_4.telephone = transformedData.contato_cliente;
        }
        // email_cliente já é passado no nível superior e internamente no BookingData (step_4.email)
        // se o campo existir no bookingDataObj.
        if (transformedData.email_cliente && !bookingDataObj.step_4.email) {
          bookingDataObj.step_4.email = transformedData.email_cliente;
        }
      }

      // Serializa o objeto BookingData de volta para uma string JSON
      transformedData.BookingData = JSON.stringify(bookingDataObj);
    } catch (e) {
      console.error("Erro ao fazer parse ou serializar BookingData:", e);
      // Se houver erro, e o BigQuery permitir null para BookingData, pode ser null.
      // Se não permitir, terá de ser uma string vazia ou JSON inválido (o que é problemático).
      transformedData.BookingData = null; // Definir como null se a validação permite null
    }
  } else if (transformedData.BookingData === undefined) {
    // Se BookingData estiver faltando ou for null, define para null explicitamente
    // se o esquema permitir ["null", "string"], ou para uma string vazia "" se não permitir null.
    transformedData.BookingData = null;
  }

  // --- 4. Remover campos de nível superior que NÃO estão no esquema do BigQuery ---
  // Estes campos foram usados para popular o BookingData, mas não devem estar no nível superior do payload.
  delete transformedData.nome_cliente; // Não no esquema de nível superior
  delete transformedData.contato_cliente; // Não no esquema de nível superior
  delete transformedData.local_entrega; // Não no esquema de nível superior

  // O esquema tem "email_cliente" no nível superior, então `email` (antigo nome)
  // não deveria existir, mas `email_cliente` deve.
  if (transformedData.hasOwnProperty("email")) {
    // Se por algum motivo o campo "email" ainda vier, transfere para "email_cliente"
    // e remove "email". (O componente React já envia "email_cliente").
    transformedData.email_cliente = transformedData.email;
    delete transformedData.email;
  }
  // Campos `lastName` e `telephone` antigos se por acaso ainda vierem, também devem ser removidos.
  delete transformedData.lastName;
  delete transformedData.telephone;

  // Ajuste para formatted_total_amount_with_taxes, se for necessário ser uma string vazia
  // ou "0" no lugar de "€0,00" se o input for vazio.
  // O componente React já envia "formatted_total_amount_with_taxes" como string.
  // Apenas garante que não é undefined/null
  if (typeof transformedData.formatted_total_amount_with_taxes !== "string") {
    transformedData.formatted_total_amount_with_taxes = String(
      transformedData.formatted_total_amount_with_taxes || "",
    );
  }

  return transformedData;
}

export function transformOrderDataToInvoice(data: {
  data: { attributes: any; relationships: any };
  included: any;
}) {
  const attributes = data.data.attributes;
  const included = data.included;
  const relationships = data.data.relationships;

  // Find the main product line item (e.g., "skus" type)
  const mainLineItem = included.find(
    // @ts-ignore

    (item) =>
      item.type === "line_items" && item.attributes.item_type === "skus",
  );

  // Find the customer details
  const customer = included.find(
    // @ts-ignore
    (item) =>
      item.type === "customers" && item.id === relationships.customer.data.id,
  );

  // Find the customer details
  const address = included.find(
    // @ts-ignore
    (item) =>
      item.type === "addresses" &&
      item.id === relationships.billing_address.data.id,
  );
  const country = new Intl.DisplayNames([attributes.language_code], {
    type: "region",
  }).of(address.attributes.country_code);

  const transformedInvoice = {
    invoice: {
      // Date: created_at, formatted as DD/MM/YYYY
      date: attributes.placed_at
        ? new Date(attributes.placed_at).toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : null,

      // Due Date: Using a placeholder as per your example
      due_date: attributes.placed_at
        ? new Date(attributes.placed_at).toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : null, // Hardcoded placeholder for now
      currency_code: attributes.currency_code,
      // Client Information
      client: {
        language: attributes.language_code,
        email: customer?.attributes?.email || null,
        name:
          address?.attributes?.full_name ||
          address?.attributes?.first_name +
            " " +
            address?.attributes?.last_name,
        // Use name, then derive from email, or fallback
        // CORRECTED LINE: Convert customer.id to an integer, then convert that integer to a string
        code: customer?.id ? String(parseInt(customer.id, 36)) : "99990",
        // fiscal_id: `${address.country_code}192817337`, //todo fiscal number on commercelayer checkout
        fiscal_id: 192817337,
        address: address.attributes.line_1,
        city: address.attributes.city,
        postal_code: address.attributes.zip_code,
        country: country,
        phone: address.attributes.phone,
      },

      // Items array
      items: [],
    },
  };

  // Populate items
  if (mainLineItem) {
    // @ts-ignore
    transformedInvoice.invoice.items.push({
      name: mainLineItem.attributes.name || "Item Name Placeholder",
      description:
        mainLineItem.attributes.metadata?.bookingData?.step_1?.[0]?.metadata
          ?.vehicleModel || "Item Description Placeholder",
      unit_price:
        mainLineItem.attributes.unit_amount_float?.toFixed(2) || "0.00",
      quantity: mainLineItem.attributes.quantity?.toFixed(1) || "0",
    });
  } else {
    // Fallback if no 'skus' line item is found, to ensure 'items' array is not empty
    // @ts-ignore
    transformedInvoice.invoice.items.push({
      name: "Default Item Name",
      description: "Default Item Description",
      unit_price: "0.00",
      quantity: "0",
    });
  }
  //todo global_discount:{value_type:value_type, value:value}  https://invoicexpress.com/api-v2/invoices/create/

  return transformedInvoice;
}
