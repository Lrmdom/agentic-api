// index.ts

import { Hono } from "hono";
import { CommerceLayer, type PriceCreate } from "@commercelayer/sdk";
import { authenticate } from "@commercelayer/js-auth";
import type { Context } from "hono";

const app = new Hono();

// Simple GET route for a sanity check
app.get("/", (c) => c.json("Hono Sanity Check: Ready to receive webhooks."));

// The main POST route to handle incoming Pub/Sub message payloads via HTTP
app.post("/", async (c: Context) => {
  console.log(
    "Hono POST method triggered (receiving Pub/Sub message via HTTP POST).",
  );

  // Helper function to handle CommerceLayer authentication
  async function getCommerceLayerToken(): Promise<string | Response> {
    console.log("Attempting to get CommerceLayer access token.");
    // It's highly recommended to use environment variables for sensitive data
    // For production, replace these with `process.env.VAR_NAME`
    const clientId = process.env.CL_INTEGRATION_CLIENT_ID;
    const clientSecret = process.env.CL_INTEGRATION_CLIENT_SECRET;
    const scope = process.env.CL_MARKET_SCOPE_EUROPE; //todo ...this defines the market automatically. the skus and prices are automatically associated to a market(Brand)

    if (!clientId || !clientSecret || !scope) {
      console.error("Missing CommerceLayer credentials.");
      return c.text(
        "Authentication failed: CommerceLayer credentials not configured.",
        500,
      );
    }

    try {
      const auth = await authenticate("client_credentials", {
        clientId: clientId,
        clientSecret: clientSecret,
        scope: scope,
      });
      console.log("Successfully obtained CommerceLayer access token.");
      return auth.accessToken;
    } catch (error) {
      console.error("Error getting CommerceLayer access token:", error);
      return c.text("Authentication failed.", 500);
    }
  }

  try {
    const accessTokenResult = await getCommerceLayerToken();
    if (typeof accessTokenResult !== "string") {
      return accessTokenResult; // Return the error Response directly
    }
    const accessToken = accessTokenResult;

    const cl = CommerceLayer({
      organization: process.env.CL_ORGANIZATION_NAME,
      accessToken: accessToken,
    });
    console.log("CommerceLayer SDK initialized.");

    // 1. Parse the incoming HTTP POST body, which is expected to be the full Pub/Sub message payload
    const pubSubPayload: any = await c.req.json();

    if (
      !pubSubPayload ||
      !pubSubPayload.message ||
      typeof pubSubPayload.message.data !== "string"
    ) {
      console.error(
        "Invalid Pub/Sub message payload format received via HTTP.",
        pubSubPayload,
      );
      return c.text(
        "Bad Request: Invalid Pub/Sub message payload format.",
        400,
      );
    }

    // 2. Extract and decode the base64-encoded 'data' field from the Pub/Sub message
    const messageDataB64 = pubSubPayload.message.data;
    let commerceLayerWebhookData: any;
    try {
      const decodedDataString = Buffer.from(messageDataB64, "base64").toString(
        "utf8",
      );
      console.log(
        "Decoded Commerce Layer webhook data string:",
        decodedDataString,
      );
      // 3. Parse the decoded string to get the actual Commerce Layer webhook content
      commerceLayerWebhookData = JSON.parse(decodedDataString);
      console.log(
        "Parsed Commerce Layer webhook JSON:",
        JSON.stringify(commerceLayerWebhookData, null, 2),
      );
    } catch (decodeError) {
      console.error(
        "Error decoding or parsing Pub/Sub message data:",
        decodeError,
      );
      return c.text(
        "Failed to process message: Invalid data format in Pub/Sub payload.",
        400,
      );
    }

    // Now, 'commerceLayerWebhookData' contains the actual webhook body,
    // which your original logic expects.
    const body = commerceLayerWebhookData;

    // The rest of your existing Commerce Layer logic follows from here,
    // now operating on the 'body' variable which holds the extracted webhook data.

    // Make a copy and delete _type if it exists, as per your original logic
    const motorbike_group_list_as_sku = { ...body };
    if (motorbike_group_list_as_sku._type) {
      delete motorbike_group_list_as_sku._type;
      console.log("Removed '_type' from the webhook data clone.");
    }

    // Ensure vehicleGroupListData exists before proceeding
    if (
      !motorbike_group_list_as_sku.vehicleGroupListData ||
      !motorbike_group_list_as_sku.vehicleGroupListData.code
    ) {
      console.error(
        "Missing 'vehicleGroupListData' or 'code' in extracted webhook data.",
      );
      return c.text(
        "Bad Request: Missing vehicleGroupListData or code in extracted data.",
        400,
      );
    }

    const skuCode = motorbike_group_list_as_sku.vehicleGroupListData.code;
    console.log(`Checking for existing SKU with code: ${skuCode}`);

    // @ts-ignore
    const skuExists = await cl.skus
      .list({
        filters: {
          code_eq: skuCode,
        },
      })
      .catch((error: any) => {
        console.error(
          "Error checking for existing SKU:",
          JSON.stringify(error.errors || error, null, 2),
        );
        throw new Error("Failed to check SKU existence.");
      });

    if (skuExists.length > 0) {
      console.log(`SKU with code ${skuCode} found. Updating existing SKU.`);
      motorbike_group_list_as_sku.vehicleGroupListData["id"] =
        skuExists[0]["id"];
      // @ts-ignore
    const updatedSku = await cl.skus
        .update(motorbike_group_list_as_sku.vehicleGroupListData)
        .catch((error: any) => {
          console.error(
            "Error updating SKU:",
            JSON.stringify(error.errors || error, null, 2),
          );
          throw new Error("Failed to update SKU.");
        });
      console.log("SKU updated successfully:", updatedSku);
    } else {
      console.log(`SKU with code ${skuCode} not found. Creating new SKU.`);

      console.log("Fetching shipping categories for 'Merchandising'.");
      // @ts-ignore
    const shippingCategories = await cl.shipping_categories
        .list({
          filters: { name_eq: "Merchandising" },
        })
        .catch((error: any) => {
          console.error(
            "Error fetching shipping categories:",
            JSON.stringify(error.errors || error, null, 2),
          );
          throw new Error("Failed to fetch shipping categories.");
        });

      if (!shippingCategories.length) {
        console.error("Shipping category 'Merchandising' not found.");
        return c.text(
          "Internal Server Error: Shipping category not configured.",
          500,
        );
      }

      motorbike_group_list_as_sku.vehicleGroupListData["shipping_category"] =
        // @ts-ignore
        cl.shipping_categories.relationship(shippingCategories[0].id);
      console.log("Associated shipping category to new SKU.");

      // @ts-ignore
      const newSku = await cl.skus
        .create(motorbike_group_list_as_sku.vehicleGroupListData)
        .catch((error: any) => {
          console.error(
            "Error creating SKU:",
            JSON.stringify(error.errors || error, null, 2),
          );
          throw new Error("Failed to create SKU.");
        });
      console.log("New SKU created successfully:", newSku);

      console.log("Fetching stock location for 'Altura Warehouse'.");
      // @ts-ignore
      const stock_location = await cl.stock_locations
        .list({
          filters: { name_eq: "Altura Warehouse" },
        })
        .catch((error: any) => {
          console.error(
            "Error fetching stock locations:",
            JSON.stringify(error.errors || error, null, 2),
          );
          throw new Error("Failed to fetch stock locations.");
        });

      if (!stock_location.length) {
        console.error("Stock location 'Altura Warehouse' not found.");
        return c.text(
          "Internal Server Error: Stock location not configured.",
          500,
        );
      }

      const stock_item = {
        sku_code: (newSku as { code: string }).code,
        quantity: 1,
        // @ts-ignore
        stock_location: cl.stock_locations.relationship(stock_location[0].id),
      };
      console.log("Creating new stock item:", stock_item);
      // @ts-ignore
      const new_stock_item = await cl.stock_items
        .create(stock_item)
        .catch((error: any) => {
          console.error(
            "Error creating stock item:",
            JSON.stringify(error.errors || error, null, 2),
          );
          throw new Error("Failed to create stock item.");
        });
      console.log("New stock item created successfully:", new_stock_item);
    }

    let vehicleListPricePeriod_as_price: PriceCreate | object = {};
    console.log(`Checking for existing price for SKU code: ${skuCode}`);
    // @ts-ignore
    const priceExists = await cl.prices
      .list({
        filters: {
          sku_code_eq: skuCode,
        },
      })
      .catch((error: any) => {
        console.error(
          "Error checking for existing price:",
          JSON.stringify(error.errors || error, null, 2),
        );
        throw new Error("Failed to check price existence.");
      });

    if (priceExists.length > 0) {
      console.log(
        `Price for SKU code ${skuCode} found. Updating existing price.`,
      );
      // @ts-ignore
      const updatedItem = await cl.prices
        .update({ id: priceExists[0].id })
        .catch((error: any) => {
          console.error(
            "Error updating price:",
            JSON.stringify(error.errors || error, null, 2),
          );
          throw new Error("Failed to update price.");
        });
      console.log("Price updated successfully:", updatedItem);
    } else {
      console.log(
        `Price for SKU code ${skuCode} not found. Creating new price.`,
      );

      console.log("Fetching price list for 'Europe Price List'.");
      // @ts-ignore
    const priceList = await cl.price_lists
        .list({
          filters: { name_eq: "Europe Price List" },
        })
        .catch((error: any) => {
          console.error(
            "Error fetching price list:",
            JSON.stringify(error.errors || error, null, 2),
          );
          throw new Error("Failed to fetch price list.");
        });

      if (!priceList.length) {
        console.error("Price list 'Europe Price List' not found.");
        return c.text("Internal Server Error: Price list not configured.", 500);
      }

      console.log(`Fetching SKU list for code: ${skuCode}`);
      // @ts-ignore
    const skuList = await cl.skus
        .list({
          filters: {
            code_eq: skuCode,
          },
        })
        .catch((error: any) => {
          console.error(
            "Error fetching SKU list for price creation:",
            JSON.stringify(error.errors || error, null, 2),
          );
          throw new Error("Failed to fetch SKU for price creation.");
        });

      if (!skuList.length) {
        console.error(`SKU with code ${skuCode} not found for price creation.`);
        return c.text(
          "Internal Server Error: SKU not found for price association.",
          500,
        );
      }

      vehicleListPricePeriod_as_price = {
        // @ts-ignore
        sku: cl.skus.relationship(skuList[0].id),
        // @ts-ignore
        price_list: cl.price_lists.relationship(priceList[0].id),
        // IMPORTANT: You'll likely need to add 'amount_cents' and 'currency_code' here
        // For example:
        // amount_cents: body.priceData.amount_cents,
        // currency_code: body.priceData.currency_code,
      } as PriceCreate;

      // @ts-ignore
    const newItem = await cl.prices
        // @ts-ignore
        .create(vehicleListPricePeriod_as_price)
        .catch((error: any) => {
          console.error(
            "Error creating price:",
            JSON.stringify(error.errors || error, null, 2),
          );
          throw new Error("Failed to create price.");
        });
      console.log("New price created successfully:", newItem);
    }

    console.log("Webhook processing completed successfully. Sending 200 OK.");
    return c.text("Data received and processed successfully.");
  } catch (error: any) {
    console.error(
      "Unhandled error during webhook processing:",
      error.message || error,
    );
    return c.text(
      `Error processing webhook request: ${error.message || "Unknown error"}`,
      500,
    );
  }
});

app.get("/:id", (c) => c.json(`get ${c.req.param("id")}`));

export default app;
