// src/utils/google-auth.ts
import fs from "fs";

/**
 * Verifica se está em ambiente de produção (Cloud Run)
 */
export function isProduction(): boolean {
  // Verificação robusta: K_SERVICE é injetado automaticamente pelo Cloud Run
  return !!(process.env.K_SERVICE || process.env.K_REVISION || process.env.NODE_ENV === 'production');
}

// Se estivermos em produção, limpamos a variável que força a busca por ficheiros JSON
if (isProduction()) {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const GOOGLE_CLOUD_PROJECT_ID = process.env.GCP_PROJECT_ID || "avid-infinity-370500";
const JSON_KEY_PATH = "./avid-infinity-370500-d9f7e84d26a4.json";

/**
 * Retorna as opções de configuração para clientes Google Cloud (BigQuery, Analytics, etc.)
 */
export function getGoogleCloudConfig(): any {
  const isProd = isProduction();

  if (isProd) {
    console.log("☁️ Config: Cloud Run detectado. Usando ADC.");
    return { projectId: GOOGLE_CLOUD_PROJECT_ID };
  }

  if (fs.existsSync(JSON_KEY_PATH)) {
    console.log("💻 Config: DEV - Usando keyFilename local.");
    return {
      projectId: GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: JSON_KEY_PATH
    };
  }

  return { projectId: GOOGLE_CLOUD_PROJECT_ID };
}

/**
 * Retorna as opções para clientes que exigem o objeto 'credentials' (JSON parseado)
 */
export function getGoogleCloudConfigWithCredentials(): { projectId: string; credentials?: any } {
  const isProd = isProduction();
  const baseConfig = { projectId: GOOGLE_CLOUD_PROJECT_ID };

  if (isProd) {
    return baseConfig;
  }

  // Tenta ler o ficheiro local para injetar o JSON explicitamente (necessário em alguns SDKs antigos)
  if (fs.existsSync(JSON_KEY_PATH)) {
    try {
      const credentials = JSON.parse(fs.readFileSync(JSON_KEY_PATH, "utf8"));
      return { ...baseConfig, credentials };
    } catch (e) {
      console.warn("⚠️ Erro ao processar JSON de credenciais em DEV:", e);
    }
  }

  return baseConfig;
}