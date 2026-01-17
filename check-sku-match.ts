import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

const credentialsJson = JSON.parse(fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8'));
const bq = new BigQuery({
  projectId: 'avid-infinity-370500',
  credentials: credentialsJson
});

console.log('🔍 Verificando correspondência de SKU codes...');

bq.query(`
  SELECT 
    catalog.sku_code as catalog_sku,
    catalog.title as catalog_title,
    events.sku_code as events_sku,
    events.vehicleModel as events_model,
    events.start_Date,
    events.end_Date,
    events.id as booking_id
  FROM 
    \`avid-infinity-370500.events_data_dataset.master_catalog_rag\` catalog
  CROSS JOIN 
    \`avid-infinity-370500.events_data_dataset.events-data-table\` events
  WHERE 
    catalog.title LIKE '%PCX%' 
    AND events.vehicleModel LIKE '%PCX%'
    AND events.status = 'approved'
  LIMIT 10
`)
  .then(([rows]) => {
    console.log(`📊 Correspondências encontradas: ${rows.length}`);
    if (rows.length > 0) {
      rows.forEach((row, i) => {
        console.log(`${i+1}. Catálogo: ${row.catalog_title} (SKU: ${row.catalog_sku})`);
        console.log(`   Eventos: ${row.events_model} (SKU: ${row.events_sku})`);
        console.log(`   📅 ${row.start_Date} até ${row.end_Date}`);
        console.log(`   🆔 ID: ${row.booking_id}`);
        console.log(`   🔗 SKUs correspondem: ${row.catalog_sku === row.events_sku ? 'SIM' : 'NÃO'}`);
        console.log('');
      });
    } else {
      console.log('❌ Nenhuma correspondência encontrada');
    }
  })
  .catch(console.error);
