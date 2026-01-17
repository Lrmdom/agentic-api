import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });

import { BigQuery } from '@google-cloud/bigquery';
import { GoogleAuth } from 'google-auth-library';
import { textEmbedding004 } from '@genkit-ai/googleai';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Configuração
const GOOGLE_CLOUD_PROJECT_ID = process.env.GCP_PROJECT_ID || 'avid-infinity-370500';
const DATASET = 'events_data_dataset';
const TABLE = 'master_catalog_rag';

// Configuração BigQuery
const clientOptions = { projectId: GOOGLE_CLOUD_PROJECT_ID };
const bq = new BigQuery(clientOptions);

// Configuração Genkit para embeddings
const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
});

// Mapeamento modelos Honda -> categorias genéricas
const modelosHonda = [
  {
    sku_code: 'honda-forza-350',
    title: 'Honda Forza 350',
    generic_category: 'scooter-350cc',
    language: 'pt',
    description: 'Scooter Honda Forza 350 - máximo de conforto e desempenho urbano',
    rag_super_chunk: 'Honda Forza 350 é um scooter premium de 350cc projetado para mobilidade urbana com excelente conforto e eficiência.',
    prices: { price: 4299, currency: 'EUR' },
    specs: {
      engine_capacity: '350cc',
      type: 'scooter',
      brand: 'Honda'
    }
  },
  {
    sku_code: 'honda-forza-125',
    title: 'Honda Forza 125',
    generic_category: 'scooter-125cc',
    language: 'pt',
    description: 'Scooter Honda Forza 125 - equilíbrio perfeito entre desempenho e economia',
    rag_super_chunk: 'Honda Forza 125 é um scooter versátil de 125cc ideal para uso diário na cidade.',
    prices: { price: 3299, currency: 'EUR' },
    specs: {
      engine_capacity: '125cc',
      type: 'scooter',
      brand: 'Honda'
    }
  },
  {
    sku_code: 'honda-pcx-125',
    title: 'Honda PCX 125',
    generic_category: 'scooter-125cc',
    language: 'pt',
    description: 'Honda PCX 125 - o scooter mais popular e confiável do mercado',
    rag_super_chunk: 'Honda PCX 125 é conhecido por sua confiabilidade, eficiência de combustível e design moderno.',
    prices: { price: 3499, currency: 'EUR' },
    specs: {
      engine_capacity: '125cc',
      type: 'scooter',
      brand: 'Honda'
    }
  },
  {
    sku_code: 'honda-sh-125',
    title: 'Honda SH 125',
    generic_category: 'scooter-125cc',
    language: 'pt',
    description: 'Honda SH 125 - estilo urbano e tecnologia avançada',
    rag_super_chunk: 'Honda SH 125 combina design italiano com tecnologia Honda para máxima performance urbana.',
    prices: { price: 3599, currency: 'EUR' },
    specs: {
      engine_capacity: '125cc',
      type: 'scooter',
      brand: 'Honda'
    }
  },
  {
    sku_code: 'honda-vision-110',
    title: 'Honda Vision 110',
    generic_category: 'scooter-125cc',
    language: 'pt',
    description: 'Honda Vision 110 - economia máxima sem comprometer a qualidade',
    rag_super_chunk: 'Honda Vision 110 é extremamente econômico e perfeito para deslocamentos urbanos.',
    prices: { price: 1899, currency: 'EUR' },
    specs: {
      engine_capacity: '110cc',
      type: 'scooter',
      brand: 'Honda'
    }
  }
];

// Função para gerar embeddings
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await ai.embed({
      embedder: 'googleai/text-embedding-004',
      content: text
    });
    
    // Acessar o embedding corretamente conforme a estrutura do Genkit
    if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object' && 'embedding' in result[0]) {
      return result[0].embedding as number[];
    } else if (typeof result === 'object' && 'embedding' in result) {
      return (result as any).embedding;
    } else {
      console.error('Estrutura inesperada do embedding:', result);
      throw new Error('Falha ao gerar embedding');
    }
  } catch (error) {
    console.error('Erro ao gerar embedding:', error);
    throw error;
  }
}

// Função principal
async function popularCatalogoHonda() {
  console.log('🏍️ Iniciando popularização do catálogo com modelos Honda...');
  
  try {
    // Limpar dados existentes (opcional)
    console.log('🧹 Limpando dados existentes...');
    await bq.query({
      query: `DELETE FROM \`${GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.${TABLE}\` WHERE sku_code LIKE 'honda-%'`
    });

    // Gerar embeddings e inserir dados
    console.log('📊 Gerando embeddings e inserindo dados...');
    
    for (const modelo of modelosHonda) {
      console.log(`🔄 Processando: ${modelo.title}`);
      
      // Gerar embedding para o conteúdo principal
      const embedding = await generateEmbedding(
        `${modelo.title} ${modelo.description} ${modelo.rag_super_chunk}`
      );

      // Inserir na tabela
      const row = {
        sku_code: modelo.sku_code,
        language: modelo.language,
        title: modelo.title,
        rag_super_chunk: modelo.rag_super_chunk,
        embedding: embedding,
        content_json: JSON.stringify({
          prices: modelo.prices,
          description: modelo.description,
          specs: modelo.specs,
          generic_category: modelo.generic_category
        }),
        last_sync: new Date()
      };

      await bq.query({
        query: `
          INSERT INTO \`${GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.${TABLE}\`
          (sku_code, language, title, rag_super_chunk, embedding, content_json, last_sync)
          VALUES (@sku_code, @language, @title, @rag_super_chunk, @embedding, JSON_QUERY(@content_json, '$'), @last_sync)
        `,
        params: {
          sku_code: row.sku_code,
          language: row.language,
          title: row.title,
          rag_super_chunk: row.rag_super_chunk,
          embedding: row.embedding,
          content_json: JSON.stringify(row.content_json),
          last_sync: row.last_sync
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

export { popularCatalogoHonda };
