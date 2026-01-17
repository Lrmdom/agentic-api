import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

const credentialsJson = JSON.parse(fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8'));
const bq = new BigQuery({
  projectId: 'avid-infinity-370500',
  credentials: credentialsJson
});

console.log('🔍 Verificando reservas PCX no período...');

bq.query(`
  SELECT 
    vehicleModel,
    store_location,
    start_Date,
    end_Date,
    id as booking_id,
    LOWER(vehicleModel) as lower_model
  FROM \`avid-infinity-370500.events_data_dataset.events-data-table\`
  WHERE 
    (status = 'approved' OR payment_status = 'paid')
    AND start_Date >= '2025-09-20'
    AND end_Date <= '2025-10-10'
    AND LOWER(vehicleModel) LIKE '%pcx%'
`)
  .then(([rows]) => {
    console.log(`\n📊 Reservas PCX no período (${rows.length}):`);
    rows.forEach((row: any, i: number) => {
      console.log(`${i+1}. ${row.vehicleModel} - ${row.store_location}`);
      console.log(`   📅 ${row.start_Date} até ${row.end_Date}`);
      console.log(`   🔤 Lower: "${row.lower_model}"`);
      console.log('');
    });
  })
  .catch(console.error);
