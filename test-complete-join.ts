import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

const credentialsJson = JSON.parse(fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8'));
const bq = new BigQuery({
  projectId: 'avid-infinity-370500',
  credentials: credentialsJson
});

console.log('🔍 Teste COMPLETO do JOIN...');

bq.query(`
  WITH 
  catalog_items AS (
    SELECT 
      sku_code,
      title,
      JSON_VALUE(content_json, '$.vehicleModels[0].name') AS vehicleModel,
      JSON_VALUE(content_json, '$.vehicleModels[0].vehicles[0].location.name') AS store_location
    FROM \`avid-infinity-370500.events_data_dataset.master_catalog_rag\`
    WHERE title LIKE '%PCX%'
  ),
  event_bookings AS (
    SELECT 
      vehicleModel,
      store_location,
      start_Date,
      end_Date,
      id as booking_id
    FROM \`avid-infinity-370500.events_data_dataset.events-data-table\`
    WHERE 
      (status = 'approved' OR payment_status = 'paid')
      AND start_Date >= '2025-09-17'
      AND end_Date <= '2025-10-20'
  )
  SELECT 
    c.sku_code,
    c.title,
    c.vehicleModel as catalog_model,
    c.store_location as catalog_location,
    e.vehicleModel as event_model,
    e.store_location as event_location,
    e.booking_id,
    e.start_Date,
    e.end_Date,
    CASE 
      WHEN e.booking_id IS NOT NULL THEN 'Indisponível'
      ELSE 'Disponível'
    END as disponibilidade
  FROM catalog_items c
  LEFT JOIN event_bookings e ON 
    (LOWER(c.vehicleModel) LIKE '%pcx%' AND LOWER(e.vehicleModel) LIKE '%pcx%')
`)
  .then(([rows]) => {
    console.log(`\n📊 Resultados completos (${rows.length}):`);
    rows.forEach((row: any, i: number) => {
      console.log(`${i+1}. ${row.title}`);
      console.log(`   Catálogo: "${row.catalog_model}" - ${row.catalog_location}`);
      console.log(`   Evento: "${row.event_model || 'NULL'}" - ${row.event_location || 'NULL'}`);
      console.log(`   📅 ${row.disponibilidade}`);
      if (row.booking_id) {
        console.log(`   🆔 Reserva: ${row.booking_id} (${row.start_Date} até ${row.end_Date})`);
      }
      console.log('');
    });
  })
  .catch(console.error);
