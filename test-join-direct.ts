import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

const credentialsJson = JSON.parse(fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8'));
const bq = new BigQuery({
  projectId: 'avid-infinity-370500',
  credentials: credentialsJson
});

console.log('🔍 Testando JOIN diretamente...');

bq.query(`
  WITH 
  vector_results AS (
    SELECT 
      base.sku_code,
      base.title,
      JSON_VALUE(base.content_json, '$.vehicleModels[0].name') AS vehicleModel,
      JSON_VALUE(base.content_json, '$.vehicleModels[0].vehicles[0].location.name') AS store_location
    FROM VECTOR_SEARCH(
      TABLE \`avid-infinity-370500.events_data_dataset.master_catalog_rag\`,
      'embedding',
      (SELECT ml_generate_embedding_result 
       FROM ML.GENERATE_EMBEDDING(
         MODEL \`avid-infinity-370500.events_data_dataset.text-embedding-004\`,
         (SELECT 'PCX 125' as content)
       )),
      top_k => 3
    ) AS busca
  ),
  existing_bookings AS (
    SELECT 
      vehicleModel,
      store_location,
      start_Date,
      end_Date,
      id as booking_id
    FROM \`avid-infinity-370500.events_data_dataset.events-data-table\`
    WHERE 
      (status = 'approved' OR payment_status = 'paid')
      AND start_Date >= '2025-09-20'
      AND end_Date <= '2025-10-10'
  )
  SELECT 
    vr.title,
    vr.vehicleModel as catalog_model,
    vr.store_location as catalog_location,
    eb.vehicleModel as event_model,
    eb.store_location as event_location,
    eb.booking_id,
    eb.start_Date,
    eb.end_Date
  FROM vector_results vr
  LEFT JOIN existing_bookings eb ON 
    (LOWER(vr.vehicleModel) LIKE LOWER('%' || REPLACE(eb.vehicleModel, ' ', '') || '%') 
     OR LOWER(eb.vehicleModel) LIKE LOWER('%' || REPLACE(vr.vehicleModel, ' ', '') || '%'))
`)
  .then(([rows]) => {
    console.log(`\n📊 Resultados do JOIN (${rows.length}):`);
    rows.forEach((row: any, i: number) => {
      console.log(`${i+1}. ${row.title}`);
      console.log(`   Catálogo: "${row.catalog_model}" - ${row.catalog_location}`);
      console.log(`   Evento: "${row.event_model}" - ${row.event_location}`);
      console.log(`   Reserva: ${row.booking_id ? 'SIM' : 'NÃO'}`);
      if (row.booking_id) {
        console.log(`   📅 ${row.start_Date} até ${row.end_Date}`);
      }
      console.log('');
    });
  })
  .catch(console.error);
