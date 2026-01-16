// routes/spbs-sync-services-user.ts
import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import { cors } from "hono/cors";
const app = new Hono();
app.use("*", cors());
// Configurações
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = "https://api.brevo.com/v3/contacts";

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface ProfileAttributes {
  app_language: any;
  brand_name: any;
  app_name: any;
  profile_id: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  pos?: any;
  address?: string | null;
  country_code?: string | null;
  country?: string | null;
  language_code?: string | null;
  device_type?: string | null;
  browser_name?: string | null;
  browser_version?: string | null;
  metadata?: any;
}

app.post("/", async (c) => {
  try {
    const attrs: ProfileAttributes = await c.req.json();

    // Validar dados obrigatórios
    if (!attrs.profile_id) {
      return c.json({ error: "profile_id é obrigatório" }, 400);
    }

    // Buscar email do profile no Supabase
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, auth_user_id,first_name,last_name")
      .eq("id", attrs.profile_id)
      .single();

    if (profileError || !profile) {
      console.error("Erro ao buscar profile:", profileError);
      return c.json({ error: "Profile não encontrado" }, 404);
    }

    if (!profile.email) {
      return c.json({ error: "Email não encontrado para este profile" }, 404);
    }

    // Preparar dados para atualização no Brevo
    const brevoUpdateData: any = {
      attributes: {},
    };
    if (attrs.device_type) {
      brevoUpdateData.attributes.DEVICETYPE = attrs.device_type;
    }
    // Adicionar atributos customizados se existirem

    if (attrs.brand_name) {
      brevoUpdateData.attributes.BRANDNAME = attrs.brand_name;
    }
    if (attrs.app_name) {
      brevoUpdateData.attributes.APPNAME = attrs.app_name;
    }

    if (attrs.device_type) {
      brevoUpdateData.attributes.DEVICETYPE = attrs.device_type;
    }

    if (attrs.country_code) {
      brevoUpdateData.attributes.COUNTRY_CODE = attrs.country_code;
    }

    if (attrs.language_code) {
      brevoUpdateData.attributes.LANGUAGE = attrs.language_code;
    }
    if (attrs.app_language) {
      brevoUpdateData.attributes.APP_LANGUAGE = attrs.app_language;
    }

    // Adicionar outros dados úteis se disponíveis
    if (attrs.country) {
      brevoUpdateData.attributes.COUNTRY = attrs.country;
    }

    if (attrs.profile_id) {
      brevoUpdateData.attributes.SUPABASE_PROFILE_ID = attrs.profile_id;
    }

    // @ts-ignore
    if (profile.auth_user_id) {
      // @ts-ignore
      brevoUpdateData.attributes.SUPABASE_AUTH_USER_ID = profile.auth_user_id;
    }

    if (profile.first_name) {
      brevoUpdateData.attributes.NOME = profile.first_name;
    }

    if (profile.last_name) {
      brevoUpdateData.attributes.SOBRENOME = profile.last_name;
    }

    // Verificar se há atributos para atualizar
    if (Object.keys(brevoUpdateData.attributes).length === 0) {
      return c.json({
        success: true,
        message: "Nenhum atributo para atualizar",
      });
    }

    console.log("Atualizando contato no Brevo:", {
      email: profile.email,
      attributes: Object.keys(brevoUpdateData.attributes),
    });

    // ✅ CORREÇÃO: Usar PUT para atualizar contato existente
    const brevoResponse = await fetch(
      `${BREVO_API_URL}/${encodeURIComponent(profile.email)}`,
      {
        method: "PUT", // ✅ Método correto para UPDATE
        headers: {
          "Content-Type": "application/json",
          "api-key": BREVO_API_KEY!,
        },
        body: JSON.stringify(brevoUpdateData),
      },
    );

    // Verificar se a resposta está vazia
    const responseText = await brevoResponse.text();

    let brevoResult: any = null;
    if (responseText && responseText.trim() !== "") {
      try {
        brevoResult = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Erro ao fazer parse da resposta do Brevo:", parseError);
        console.log("Resposta original do Brevo:", responseText);
      }
    }

    if (!brevoResponse.ok) {
      console.error("Erro ao atualizar Brevo:", {
        status: brevoResponse.status,
        statusText: brevoResponse.statusText,
        response: responseText,
      });

      // Se for 404, o contato não existe - criar novo
      if (brevoResponse.status === 404) {
        return await createBrevoContact(
          profile.email,
          brevoUpdateData.attributes,
          c,
        );
      }

      return c.json(
        {
          error: "Erro ao atualizar contato no Brevo",
          status: brevoResponse.status,
          details: responseText || "Resposta vazia",
        },
        // @ts-ignore
        brevoResponse.status,
      );
    }

    // Log de sucesso
    console.log("Contato atualizado com sucesso no Brevo:", {
      email: profile.email,
      attributes: Object.keys(brevoUpdateData.attributes),
      brevo_response: brevoResult,
    });

    return c.json({
      success: true,
      message: "Contato atualizado com sucesso",
      email: profile.email,
      updated_attributes: Object.keys(brevoUpdateData.attributes),
      brevo_response: brevoResult,
    });
  } catch (error) {
    console.error("Erro interno no servidor:", error);
    return c.json(
      {
        error: "Erro interno no servidor",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// Função para criar contato se não existir
async function createBrevoContact(email: string, attributes: any, c: any) {
  try {
    const createData = {
      email: email,
      attributes: attributes,
      updateEnabled: true,
    };

    console.log("Criando novo contato no Brevo:", email);

    // ✅ Usar POST para criar novo contato
    const createResponse = await fetch(BREVO_API_URL, {
      method: "POST", // ✅ Método correto para CREATE
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY!,
      },
      body: JSON.stringify(createData),
    });

    // Verificar se a resposta está vazia
    const responseText = await createResponse.text();

    let createResult: any = null;
    if (responseText && responseText.trim() !== "") {
      try {
        createResult = JSON.parse(responseText);
      } catch (parseError) {
        console.error(
          "Erro ao fazer parse da resposta do Brevo (create):",
          parseError,
        );
        console.log("Resposta original do Brevo (create):", responseText);
      }
    }

    if (!createResponse.ok) {
      console.error("Erro ao criar contato no Brevo:", {
        status: createResponse.status,
        statusText: createResponse.statusText,
        response: responseText,
      });

      return c.json(
        {
          error: "Erro ao criar contato no Brevo",
          status: createResponse.status,
          details: responseText || "Resposta vazia",
        },
        createResponse.status,
      );
    }

    console.log("Contato criado com sucesso no Brevo:", {
      email: email,
      brevo_response: createResult,
    });

    return c.json({
      success: true,
      message: "Contato criado com sucesso no Brevo",
      email: email,
      created_attributes: Object.keys(attributes),
      brevo_response: createResult,
    });
  } catch (error) {
    console.error("Erro ao criar contato no Brevo:", error);
    return c.json(
      {
        error: "Erro ao criar contato no Brevo",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}

// Health check endpoint para testar a rota
app.get("/health", async (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    brevo_configured: !!BREVO_API_KEY,
    supabase_configured: !!(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ),
  });
});

export default app;
