import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

const credentialsJson = JSON.parse(fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8'));
const bq = new BigQuery({
  projectId: 'avid-infinity-370500',
  credentials: credentialsJson
});

console.log('🔍 Verificando SKUs no catálogo e eventos...');

async function checkSKUs() {
  // SKUs no catálogo para PCX
  console.log('\n📋 **SKUs NO CATÁLOGO (PCX):**');
  const catalogResults = await bq.query(`
    SELECT sku_code, title 
    FROM \`avid-infinity-370500.events_data_dataset.master_catalog_rag\`
    WHERE title LIKE '%PCX%'
    LIMIT 5
  `);
  
  catalogResults[0].forEach((row: any) => {
    console.log(`- ${row.title}: ${row.sku_code}`);
  });

  // SKUs nos eventos para PCX
  console.log('\n📋 **SKUs NOS EVENTOS (PCX):**');
  const eventsResults = await bq.query(`
    SELECT DISTINCT sku_code, vehicleModel
    FROM \`avid-infinity-370500.events_data_dataset.events-data-table\`
    WHERE vehicleModel LIKE '%PCX%'
    LIMIT 5
  `);
  
  eventsResults[0].forEach((row: any) => {
    console.log(`- ${row.vehicleModel}: ${row.sku_code}`);
  });

  // Verificar se há algum SKU comum
  console.log('\n🔍 **PROCURANDO CORRESPONDÊNCIAS...**');
  const matchResults = await bq.query(`
    SELECT 
      catalog.sku_code,
      catalog.title,
      events.sku_code as event_sku,
      events.vehicleModel
    FROM \`avid-infinity-370500.events_data_dataset.master_catalog_rag\` catalog
    CROSS JOIN \`avid-infinity-370500.events_data_dataset.events-data-table\` events
    WHERE catalog.sku_code = events.sku_code
    LIMIT 5
  `);
  
  console.log(`Correspondências de SKU: ${matchResults[0].length}`);
  matchResults[0].forEach((row: any) => {
    console.log(`- ${row.title} ↔ ${row.vehicleModel} (SKU: ${row.sku_code})`);
  });
}

checkSKUs().catch(console.error);
