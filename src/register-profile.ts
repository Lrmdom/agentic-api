import { Hono } from "hono";
import { cors } from "hono/cors";
import { createClient } from "@supabase/supabase-js";

import {
  ensureListAndAddContact,
  ensureSegmentAndAddContact,
  ensureFolderExists,
  ensureListExists,
  ensureContactExists, // 👈 Esta função já faz a criação
} from "./utils/brevoUtils.js";

import { ensureProfileServiceBrand } from "./utils/profileUtils.js";

const app = new Hono();
app.use("*", cors());

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.SUPABASE_URL;

// Criar cliente Supabase
// @ts-ignore
const supabase = createClient(supabaseUrl, SERVICE_ROLE_KEY!);

app.post("/", async (c) => {
  try {
    const { data } = await c.req.json();
    console.log("📩 Recebido:", data);

    // Garantir relacionamento Supabase
    await ensureProfileServiceBrand(
      data.user.id,
      data.user.email,
      "Brevo",
      data.user.email,
      data.envData,
      supabase,
    );

    // 1. Garantir que a estrutura Brevo existe
    const folder = await ensureFolderExists(data.envData);
    const list = await ensureListExists(
      data.envData,
      folder /* A função ensureListExists precisa de existingFolder, mas a chamada anterior a ensureFolderExists já garante isso. */,
    );

    // 2. Garantir que o contacto existe (cria se não existir)
    // A função ensureContactExists é um 'guarantor', não apenas um 'checker'.
    // Portanto, após esta linha, o contacto JÁ existe no Brevo.
    const contact = await ensureContactExists(data);

    await ensureListAndAddContact(
      data.user.email,
      data.envData,
      folder,
      list,
      contact,
      data,
    );

    //todo rules engine to the rescue. create segments on brevo ui then add attributes to contact that match the segment et voilá
    //json rules must have the hardcoded segments ex:segurotech-app-es para user espanhol(broser deteted or website lang,etc...)
    //await ensureSegmentAndAddContact(data.user.email, data.envData);

    return c.json({
      success: true,
      auth_user_id: data.user.id,
      email: data.user.email,
    });
  } catch (err) {
    console.error("❌ Erro ao registrar usuário:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

export default app;
