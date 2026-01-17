import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });

import { BigQuery } from '@google-cloud/bigquery';
import { GoogleAuth } from 'google-auth-library';
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

// Ler dados do arquivo Sanity
const sanityData = JSON.parse(fs.readFileSync('/Users/leoneldomingos/ridesrent-sanity-data-pt.json', 'utf8'));

// Função para unificar dados
async function unificarDadosCatalogo() {
  console.log('🔄 Iniciando unificação de dados do catálogo...');
  
  try {
    // 1. Consultar modelos Honda existentes no BigQuery
    console.log('📋 Consultando modelos Honda no BigQuery...');
    const [modelosHonda] = await bq.query({
      query: `
        SELECT sku_code, title, content_json
        FROM \`${GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.${TABLE}\`
        WHERE sku_code LIKE 'honda-%'
      `,
      ...clientOptions
    });

    console.log(`✅ Encontrados ${modelosHonda.length} modelos Honda no BigQuery`);

    // 2. Para cada modelo Honda, encontrar grupo correspondente nos dados Sanity
    console.log('🔍 Mapeando modelos com grupos Sanity...');
    
    for (const modeloHonda of modelosHonda) {
      const modeloTitle = modeloHonda.title;
      const skuCode = modeloHonda.sku_code;
      
      console.log(`📝 Processando ${modeloTitle} (${skuCode})...`);
      
      // Encontrar grupo correspondente baseado no modelo
      let grupoCorrespondente = null;
      
      // Mapeamento manual baseado nos dados Sanity
      if (modeloTitle.includes('Forza 350')) {
        grupoCorrespondente = sanityData[0].vehicleGroupLists.find(g => g.code === 'scooter-350cc');
      } else if (modeloTitle.includes('PCX 125') || modeloTitle.includes('SH 125') || modeloTitle.includes('Vision 110')) {
        grupoCorrespondente = sanityData[0].vehicleGroupLists.find(g => g.code === 'scooter-125cc');
      } else if (modeloTitle.includes('CB 500')) {
        grupoCorrespondente = sanityData[1].vehicleGroupLists.find(g => g.code === 'motorbike-350cc');
      }
      
      if (!grupoCorrespondente) {
        console.log(`⚠️ Grupo não encontrado para ${modeloTitle}`);
        continue;
      }
      
      console.log(`✅ Grupo encontrado: ${grupoCorrespondente.name} (${grupoCorrespondente.code})`);
      
      // 3. Criar estrutura vehicleModels para o modelo Honda
      const vehicleModels = [
        {
          avatar: `https://cdn.sanity.io/images/fv48p2bt/production/honda-${skuCode.split('-')[1]}-${skuCode.split('-')[2]}.jpg?auto=format&w=500`,
          modelAcessories: grupoCorrespondente.vehicleModels?.[0]?.modelAcessories || [],
          modelLink: `https://www.honda.pt/motocicletas/${skuCode.split('-')[1]}/${skuCode.split('-')[2]}`,
          name: modeloTitle,
          title: `${modeloTitle} pt`,
          vehicleGroupTypes: [
            {
              avatar: "https://cdn.sanity.io/images/fv48p2bt/production/281c849f5b732ab41e9826ac3ccc68bb0706281f-1200x800.webp?auto=format&w=500",
              name: "City",
              title: "cidade"
            }
          ],
          vehicles: [
            {
              avatar: `https://cdn.sanity.io/images/fv48p2bt/production/honda-${skuCode.split('-')[1]}-${skuCode.split('-')[2]}-thumb.jpg?auto=format&w=70`,
              location: { name: "Faro" },
              mileage: Math.floor(Math.random() * 5000),
              name: `1-${modeloTitle.toLowerCase().replace(/\s+/g, '-')}`,
              registration: "81-HN-001",
              title: modeloTitle,
              vehicleModel: { name: modeloTitle }
            }
          ]
        }
      ];
      
      // 4. Atualizar content_json com dados completos
      const contentJsonAtual = JSON.parse(modeloHonda.content_json);
      contentJsonAtual.vehicleModels = vehicleModels;
      contentJsonAtual.prices = grupoCorrespondente.prices || [];
      contentJsonAtual.availableAssurancePackages = grupoCorrespondente.availableAssurancePackages || [];
      contentJsonAtual.bookingOptions = grupoCorrespondente.bookingOptions || [];
      contentJsonAtual.vehicleGroupCode = grupoCorrespondente.code;
      contentJsonAtual.vehicleGroupName = grupoCorrespondente.name;
      contentJsonAtual.vehicleGroupTitle = grupoCorrespondente.title;
      
      // 5. Atualizar registro no BigQuery
      console.log(`💾 Atualizando ${modeloTitle} no BigQuery...`);
      await bq.query({
        query: `
          UPDATE \`${GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.${TABLE}\`
          SET content_json = PARSE_JSON(@content_json),
              last_sync = @last_sync
          WHERE sku_code = @sku_code
        `,
        params: {
          sku_code: skuCode,
          content_json: JSON.stringify(contentJsonAtual),
          last_sync: new Date()
        }
      });
      
      console.log(`✅ ${modeloTitle} atualizado com sucesso`);
    }
    
    // 6. Verificar resultado final
    const [resultadoFinal] = await bq.query({
      query: `
        SELECT 
          COUNT(*) as total_honda,
          COUNT(DISTINCT sku_code) as modelos_honda_unicos,
          COUNTIF(JSON_EXTRACT_SCALAR(content_json, '$.vehicleModels') IS NOT NULL) as com_vehicle_models
        FROM \`${GOOGLE_CLOUD_PROJECT_ID}.${DATASET}.${TABLE}\`
        WHERE sku_code LIKE 'honda-%'
      `,
      ...clientOptions
    });

    console.log('🎉 Unificação concluída com sucesso!');
    console.log(`📊 Total de modelos Honda: ${resultadoFinal[0].total_honda}`);
    console.log(`🏍️ Modelos únicos Honda: ${resultadoFinal[0].modelos_honda_unicos}`);
    console.log(`📝 Com vehicleModels: ${resultadoFinal[0].com_vehicle_models}`);

  } catch (error) {
    console.error('❌ Erro na unificação:', error);
    throw error;
  }
}

// Executar
if (import.meta.url === `file://${process.argv[1]}`) {
  unificarDadosCatalogo()
    .then(() => {
      console.log('✅ Unificação de dados concluída com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Falha na unificação:', error);
      process.exit(1);
    });
}

export { unificarDadosCatalogo };
