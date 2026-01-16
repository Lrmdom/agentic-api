import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import {
  ensureContactExists,
  ensureListAndAddContact,
} from "./utils/brevoUtils.js";
const app = new Hono();

// --- INICIALIZAÇÃO ÚNICA (Fora da Rota para Eficiência) ---

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// O cliente Supabase é criado apenas uma vez
// @ts-ignore
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// -----------------------------------------------------------

app.post("/", async (c) => {
  try {
    const payload = await c.req.json();
    const { data, included } = payload;

    // --- VERIFICAÇÕES DE DADOS (Importantes para evitar erros Uncaught) ---

    // Verificar dados essenciais antes de continuar
    if (
      !data ||
      !data.attributes ||
      !data.attributes.customer_email ||
      !included ||
      included.length === 0 ||
      !included[0].attributes
    ) {
      console.warn(
        "Payload incompleto ou sem detalhes da morada ('included'). Processamento terminado.",
      );
      // Retorna 200 OK mesmo assim para não re-tentar webhooks inválidos.
      return c.json(
        {
          message:
            "Payload recebido, mas dados insuficientes para atualização.",
        },
        200,
      );
    }

    const email = data.attributes.customer_email;
    const address = included[0].attributes;

    const filteredAddress = {
      first_name: address.first_name,
      last_name: address.last_name,
      full_name: address.full_name,
      name: address.name,
      line_1: address.line_1,
      line_2: address.line_2,
      city: address.city,
      zip_code: address.zip_code,
      state_code: address.state_code,
      country_code: address.country_code,
      phone: address.phone,
    };
    console.log(`Iniciando sincronização de endereço para o email: ${email}`);

    // --- UPDATE SUPABASE ---
    const { error } = await supabase
      .from("profiles")
      .update({ cl_address: filteredAddress })
      .eq("email", email);

    if (error) {
      console.error("❌ Erro ao atualizar endereço no Supabase:", error);
      // Aqui, decidimos devolver 200 OK ao CL, mas logamos o erro interno
      // Isto previne que o CL re-envie o Webhook repetidamente por um erro na DB.
      // A única exceção seria se quiséssemos que o CL re-tentasse.
      return c.json(
        { message: "Atualização falhou, mas webhook acknowledged." },
        200,
      );
    }

    console.log(
      `✅ Sincronização concluída com sucesso para o email: ${email}`,
    );

    // --- RETORNA 200 OK EM CASO DE SUCESSO ---
    return c.json({ message: "Perfil atualizado com sucesso." }, 200);
  } catch (err) {
    // Erro inesperado (ex: falha no c.req.json())
    console.error("❌ Erro fatal no processamento do webhook:", err);
    // Para garantir o acknowledgment do webhook, retornamos 200 OK (embora 500 fosse ideal)
    // A maioria dos sistemas de webhook espera um 2xx para parar de re-tentar.
    return c.json(
      { success: false, error: "Erro interno no processamento do payload." },
      200,
    );
  }
});

export default app;
