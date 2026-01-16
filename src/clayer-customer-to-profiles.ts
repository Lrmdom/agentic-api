import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { authenticate } from "@commercelayer/js-auth";
import { CommerceLayer } from "@commercelayer/sdk";

const app = new Hono();

/**
 * Pause execution for a given number of milliseconds.
 * @param {number} ms
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

// @ts-ignore
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function getLatestCustomerOrder(customerId: string) {
  try {
    const appAuth = await authenticate("client_credentials", {
      // @ts-ignore
      clientId: process.env.CL_INTEGRATION_CLIENT_ID,
      clientSecret: process.env.CL_INTEGRATION_CLIENT_SECRET,
    });

    const cl = CommerceLayer({
      organization: process.env.CL_ORGANIZATION_NAME,
      accessToken: appAuth.accessToken,
    });

    const orders = await (cl as any).orders.list({
      filters: { customer_id_eq: customerId },
      sort: { created_at: "desc" },
      // @ts-ignore
      page: { limit: 1 },
    });

    return orders.length > 0 ? orders[0] : null;
  } catch (error) {
    console.error("Error fetching latest order:", error);
    throw error;
  }
}

// Webhook route
app.post("/", async (c) => {
  try {
    const payload = await c.req.json();
    const emailRaw = payload?.data?.attributes?.email;
    if (!emailRaw) return c.json({ error: "Missing email" }, 400);
    const email = String(emailRaw).trim().toLowerCase();
    const pwd = process.env.DEFAULT_TEST_PASSWORD || "TempPass123!";

    const customerId = payload?.data?.id;
    console.log("Received email:", email);

    // Check if user already exists in Supabase
    // @ts-ignore
    const adminListUrl = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
    const listRes = await fetch(adminListUrl, {
      // @ts-ignore
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    const parsedResponse = await listRes.json();
    const existingUsers = parsedResponse.users || [];
    const existingUser = existingUsers.find((u: any) => u.email === email);

    if (existingUser) {
      return c.json({ message: "User already exists" }, 200);
    }

    // --- LÓGICA DE EXTRAÇÃO ROBUSDA DE DOMÍNIO ---
    let domain: string | null = null;
    const orderInWebhook =
      payload?.included?.find((i: any) => i.type === "orders") ?? null;

    // 1. Initial Check: Ordem no Webhook
    if (orderInWebhook?.attributes?.metadata?.domain) {
      domain = orderInWebhook.attributes.metadata.domain;
      console.log(
        `[LOG] SUCCESS: Domain found in webhook payload (Order). Value: ${domain}`,
      );
    }

    // 2. Search in all Line Items
    const lineItems =
      payload?.included?.filter((i: any) => i.type === "line_items") || [];

    for (const lineItem of lineItems) {
      if (!domain && lineItem?.attributes?.metadata?.domain) {
        domain = lineItem.attributes.metadata.domain;
        console.log(
          `[LOG] SUCCESS: Domain found in line_item ${lineItem.id} (Direct Metadata). Value: ${domain}`,
        );
      }
      /*
      const bookingData = lineItem?.attributes?.metadata?.bookingData;
      if (!domain && bookingData?.step_1?.[0]?.metadata?.domain) {
        domain = bookingData.step_1[0].metadata.domain;
        console.log(
          `[LOG] SUCCESS: Domain found in line_item ${lineItem.id} (Nested BookingData). Value: ${domain}`,
        );
        // Parar assim que o domínio for encontrado (e sem necessidade de extrair nomes)
        break;
      }*/

      // Se o domínio for encontrado por uma das condições acima, a próxima iteração irá ignorar a procura.
      if (domain) break;
    }

    // Log se não foi encontrado no webhook
    if (!domain) {
      console.warn(
        "[LOG] FAIL: Domain NOT found in webhook payload. Checking CL API...",
      );
    }

    // 3. Fallback Re-fetch (apenas se o domínio NÃO for encontrado)
    if (!domain && customerId) {
      try {
        console.log(
          "[LOG] ACTION: Executing immediate Commerce Layer API fetch for latest order data.",
        );

        const latestOrder = await getLatestCustomerOrder(customerId);

        if (latestOrder?.metadata?.domain) {
          domain = latestOrder.metadata.domain;
          console.log(
            `[LOG] SUCCESS: Domain fetched from Commerce Layer API on retry. Value: ${domain}`,
          );
        } else {
          console.warn(
            `[LOG] FAIL: Domain NOT found in CL API order data. Order ID: ${latestOrder?.id ?? "N/A"}`,
          );
        }
      } catch (apiError) {
        console.error(
          `[ERROR] Failed to fetch order from CL API. Error: ${apiError}`,
        );
      }
    }
    // --- FIM LÓGICA DE EXTRAÇÃO ROBUSDA DE DOMÍNIO ---

    const redirectUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:5173/welcome-and-reset-password"
        : domain
          ? `https://${domain}/welcome-and-reset-password`
          : "https://execlog.com/welcome-and-reset-password";

    console.log(`[RESULT] Final Redirect URL: ${redirectUrl}`);
    console.log(`[RESULT] Used Domain Value: ${domain}`);

    // Create Supabase user
    const { data: userData, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password: pwd,
        email_confirm: false,
        // Usando metadados mínimos/genéricos
        user_metadata: {
          full_name: email,
          locale: "pt-PT",
        },
      });

    if (createError) {
      console.error("Error creating user:", createError);
      return c.json({ error: createError.message ?? createError }, 500);
    }

    // Generate signup link
    // @ts-ignore
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "signup",
        email,
        password: pwd,
        options: { redirectTo: redirectUrl },
      });

    if (linkError) {
      console.error("Error generating signup link:", linkError);
      return c.json({ error: linkError.message ?? linkError }, 500);
    }

    const actionLink = linkData?.properties?.action_link;

    // Send email via Brevo
    const mailPayload = {
      sender: { name: "Execlog", email: "noreply@execlog.com" },
      // Usando email e um nome genérico
      to: [{ email, name: "Cliente" }],
      subject: "Confirme o seu registo",
      htmlContent: `<p>Click o link para completar o seu registo: <a href="${actionLink}">${actionLink}</a></p>`,
    };

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      // @ts-ignore
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify(mailPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Brevo send error:", errText);
      return c.json({ error: "Failed sending email" }, 500);
    }

    return c.json({ ok: true }, 200);
  } catch (err) {
    console.error("General error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;
