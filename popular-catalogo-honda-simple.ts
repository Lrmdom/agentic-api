import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });

import { BigQuery } from '@google-cloud/bigquery';
import { GoogleAuth } from 'google-auth-library';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import * as fs from 'fs';

// Configuração
const GOOGLE_CLOUD_PROJECT_ID = process.env.GCP_PROJECT_ID || 'avid-infinity-370500';
const DATASET = 'events_data_dataset';
const TABLE = 'master_catalog_rag';

// Configuração BigQuery
let clientOptions: any = { projectId: GOOGLE_CLOUD_PROJECT_ID };

if (fs.existsSync('avid-infinity-370500-d9f7e84d26a4.json')) {
  const credentialsJson = fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8');
  clientOptions.credentials = JSON.parse(credentialsJson);
}

const bq = new BigQuery(clientOptions);

// Configuração Genkit para embeddings
const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
});

// Dados Honda - modelos individuais específicos
const modelosHonda = [
  {
    sku_code: 'honda-forza-350',
    title: 'Honda Forza 350',
    language: 'pt',
    rag_super_chunk: 'Honda Forza 350 - scooter premium de 350cc com capacidade de depósito de 11.7 litros. Design moderno e excelente conforto para mobilidade urbana.',
    content_json: JSON.stringify({
      prices: { price: 4299, currency: 'EUR' },
      description: 'Scooter Honda Forza 350 - máximo de conforto e desempenho urbano',
      specs: { 
        engine_capacity: '350cc', 
        type: 'scooter', 
        brand: 'Honda',
        fuel_tank_capacity: '11.7L',
        model: 'Forza 350'
      }
    })
  },
  {
    sku_code: 'honda-pcx-125',
    title: 'Honda PCX 125',
    language: 'pt',
    rag_super_chunk: 'Honda PCX 125 - scooter confiável de 125cc com capacidade de depósito de 8 litros. Conhecido por eficiência de combustível e design moderno.',
    content_json: JSON.stringify({
      prices: { price: 3499, currency: 'EUR' },
      description: 'Honda PCX 125 - o scooter mais popular e confiável do mercado',
      specs: { 
        engine_capacity: '125cc', 
        type: 'scooter', 
        brand: 'Honda',
        fuel_tank_capacity: '8L',
        model: 'PCX 125'
      }
    })
  },
  {
    sku_code: 'honda-sh-125',
    title: 'Honda SH 125',
    language: 'pt',
    rag_super_chunk: 'Honda SH 125 - scooter urbano de 125cc com capacidade de depósito de 7.5 litros. Combina design italiano com tecnologia Honda.',
    content_json: JSON.stringify({
      prices: { price: 3599, currency: 'EUR' },
      description: 'Honda SH 125 - estilo urbano e tecnologia avançada',
      specs: { 
        engine_capacity: '125cc', 
        type: 'scooter', 
        brand: 'Honda',
        fuel_tank_capacity: '7.5L',
        model: 'SH 125'
      }
    })
  },
  {
    sku_code: 'honda-vision-110',
    title: 'Honda Vision 110',
    language: 'pt',
    rag_super_chunk: 'Honda Vision 110 - scooter econômico de 110cc com capacidade de depósito de 5.5 litros. Ideal para deslocamentos urbanos eficientes.',
    content_json: JSON.stringify({
      prices: { price: 1899, currency: 'EUR' },
      description: 'Honda Vision 110 - economia máxima sem comprometer a qualidade',
      specs: { 
        engine_capacity: '110cc', 
        type: 'scooter', 
        brand: 'Honda',
        fuel_tank_capacity: '5.5L',
        model: 'Vision 110'
      }
    })
  },
  {
    sku_code: 'honda-cb-500x',
    title: 'Honda CB 500X',
    language: 'pt',
    rag_super_chunk: 'Honda CB 500X - motocicleta versátil de 500cc com design adventure. Excelente para uso urbano e viagens.',
    content_json: JSON.stringify({
      prices: { price: 5999, currency: 'EUR' },
      description: 'Honda CB 500X - motocicleta adventure versátil',
      specs: { 
        engine_capacity: '500cc', 
        type: 'motorcycle', 
        brand: 'Honda',
        model: 'CB 500X'
      }
    })
  },
  {
    sku_code: 'honda-cb-500',
    title: 'Honda CB 500',
    language: 'pt',
    rag_super_chunk: 'Honda CB 500 - motocicleta naked de 500cc com motor paralelo. Ideal para uso diário e aprendizado.',
    content_json: JSON.stringify({
      prices: { price: 5499, currency: 'EUR' },
      description: 'Honda CB 500 - motocicleta naked versátil',
      specs: { 
        engine_capacity: '500cc', 
        type: 'motorcycle', 
        brand: 'Honda',
        model: 'CB 500'
      }
    })
  }
];

// Função para gerar embeddings (igual ao ridesrent-sanity-data-bucket.ts)
async function generateEmbeddings(text: string) {
  const endpoint = `https://europe-southwest1-aiplatform.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/europe-southwest1/publishers/google/models/text-embedding-004:predict`;

  const auth = new GoogleAuth({
    credentials: clientOptions.credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ content: text, task_type: "RETRIEVAL_DOCUMENT" }],
    }),
  });

  if (!response.ok)
    throw new Error(`Embedding API error: ${response.statusText}`);
  const data = await response.json();
  return data.predictions[0].embeddings.values;
}

// Função principal
async function popularCatalogoHonda() {
  console.log('🏍️ Iniciando popularização do catálogo com modelos Honda...');
  
  try {
    // Limpar dados existentes
    console.log('🧹 Limpando dados existentes...');
    await bq.query({
      query: `DELETE FROM \`${GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.${TABLE}\` WHERE sku_code LIKE 'honda-%'`
    });

    // Gerar embeddings e inserir dados
    console.log('📊 Gerando embeddings e inserindo dados...');
    
    for (const modelo of modelosHonda) {
      console.log(`🔄 Processando: ${modelo.title}`);
      
      // Gerar embedding
      const embedding = await generateEmbeddings(modelo.rag_super_chunk);

      // Inserir na tabela
      await bq.query({
        query: `
          INSERT INTO \`${GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.${TABLE}\`
          (sku_code, language, title, rag_super_chunk, embedding, content_json, last_sync)
          VALUES (@sku_code, @language, @title, @rag_super_chunk, @embedding, @content_json, @last_sync)
        `,
        params: {
          sku_code: modelo.sku_code,
          language: modelo.language,
          title: modelo.title,
          rag_super_chunk: modelo.rag_super_chunk,
          embedding: embedding,
          content_json: modelo.content_json,
          last_sync: new Date()
        }
      });

      console.log(`✅ ${modelo.title} inserido com sucesso`);
    }

    // Verificar resultado
    const [result] = await bq.query({
      query: `
        SELECT COUNT(*) as total, COUNT(DISTINCT sku_code) as modelos 
        FROM \`${GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.${TABLE}\` 
        WHERE sku_code LIKE 'honda-%'
      `
    });

    console.log('🎉 Catálogo atualizado com sucesso!');
    console.log(`📊 Total de registros Honda: ${result[0].total}`);
    console.log(`🏍️ Modelos únicos: ${result[0].modelos}`);

  } catch (error) {
    console.error('❌ Erro ao popular catálogo:', error);
    throw error;
  }
}

// Executar
if (import.meta.url === `file://${process.argv[1]}`) {
  popularCatalogoHonda()
    .then(() => {
      console.log('✅ Processo concluído com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Falha no processo:', error);
      process.exit(1);
    });
}
