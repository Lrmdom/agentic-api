// books.ts
import { Hono } from "hono";
import { transformOrderDataToInvoice } from "./clayerEventsTransformer.js";
import { sendBrevoOrderEmail } from "./brevo-email-function.js";
import https from "https"; // You need to import the https module
import { createWebhookValidator } from "./middlewares/createWebhookValidator.js";
import { getTemplateNameByRules } from "./brevo-email-function.js";
import { cors } from "hono/cors";

const WEBHOOK_SECRET = process.env.CL_ORDER_INVOICE_SECRET;

// Crie o middleware para esta rota específica
// @ts-ignore
const webhookValidator = createWebhookValidator(WEBHOOK_SECRET);
const app = new Hono();
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["POST"],
  }),
);
app.use(webhookValidator);

app.get("/", (c) => {
  //https://docs.commercelayer.io/core/external-resources/external-order-validation#triggering-external-validation
  return c.json({
    success: true,
    data: {},
  });
});
app.post("/", async (c) => {
  const orderData = await c.req.json();

  try {
    const templateName = getTemplateNameByRules(orderData);
    //Invoice Express conditions to emit invoice and send by mail, events names[orders.pay,orders.fulfill]
    if (templateName.endsWith(".pay") || templateName.endsWith(".fulfill")) {
      const transformedDataToInvoice = transformOrderDataToInvoice(orderData);

      const invoiceExpressHostname = "execlog.app.invoicexpress.com";
      const apiKey = process.env.INVOICEXPRESS_API_KEY;
      const path = `/invoices?api_key=${apiKey}`;

      const options = {
        method: "POST",
        hostname: invoiceExpressHostname,
        port: 443, // HTTPS requests use port 443 by default
        path: path,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(
            JSON.stringify(transformedDataToInvoice),
          ),
          Accept: "application/json",
        },
      };
      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          // @ts-ignore
          let chunks = [];

          // When data is received, push it to our chunks array
          res.on("data", (chunk) => {
            chunks.push(chunk);
          });

          // When the response is complete, we check the status code
          res.on("end", () => {
            // @ts-ignore
            const body = Buffer.concat(chunks).toString();
            // Check for successful status codes (2xx)
            // @ts-ignore
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                statusCode: res.statusCode,
                body: body,
              });
            } else {
              // For error status codes, we reject the promise
              reject({
                statusCode: res.statusCode,
                body: body,
              });
            }
          });
        });

        // Handle network errors before the response is received
        req.on("error", (error) => {
          reject({
            statusCode: 500,
            error: error.message,
          });
        });

        // Write the request body and end the request
        req.write(JSON.stringify(transformedDataToInvoice));
        req.end();
      });
      // @ts-ignore
      const invoiceData = JSON.parse(response.body);
      console.log(invoiceData);
      const sendEmalResult = await sendBrevoOrderEmail(
        orderData,
        templateName,
        invoiceData,
      );
      if (sendEmalResult.ok) {
        return c.json(
          {
            errors: null,
            success: true,
            message:
              "Data successfully sent to InvoiceXpress.and email sent also",
            // @ts-ignore
            response: response.body, // The response body from the server
          },
          200,
        );
      }
    } else {
      console.log("O template não corresponde a nenhum dos sufixos esperados.");
      const sendEmalResult = await sendBrevoOrderEmail(orderData, templateName);
      if (sendEmalResult.ok) {
        return c.json(
          {
            errors: null,
            success: true,
            message: "Data successfully sent by email ",
            // @ts-ignore
            response: response.body, // The response body from the server
          },
          200,
        );
      }
    }
  } catch (error) {
    // If the promise rejected, handle the error here
    console.error(
      // @ts-ignore
      `Error sending data to InvoiceXpress: ${error.statusCode} - ${error.error || error.body}`,
    );

    return c.json(
      {
        // @ts-ignore
        errors: `Failed to send data to InvoiceXpress: ${error.statusCode}`,
        success: false,
        // @ts-ignore
        invoicexpress_error_details: error.error || error.body,
      },
      // @ts-ignore
      error.statusCode || 500,
    );
  }
});

app.get("/:id", (c) => c.json(`get ${c.req.param("id")}`));

export default app;
