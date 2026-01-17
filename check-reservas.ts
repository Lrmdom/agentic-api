import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

const credentialsJson = JSON.parse(fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8'));
const bq = new BigQuery({
  projectId: 'avid-infinity-370500',
  credentials: credentialsJson
});

console.log('🔍 Verificando reservas existentes...');

bq.query(`
  SELECT 
    vehicleModel,
    store_location,
    sku_code,
    start_Date,
    end_Date,
    status,
    payment_status,
    id as booking_id
  FROM \`avid-infinity-370500.events_data_dataset.events-data-table\`
  WHERE 
    (status = 'approved' OR payment_status = 'paid')
    AND vehicleModel LIKE '%Honda%'
    AND start_Date >= '2025-05-01'
    AND end_Date <= '2025-05-31'
  ORDER BY start_Date DESC
  LIMIT 10
`)
  .then(([rows]) => {
    console.log(`📊 Reservas Honda encontradas: ${rows.length}`);
    if (rows.length > 0) {
      rows.forEach((row, i) => {
        console.log(`${i+1}. ${row.vehicleModel} - ${row.store_location}`);
        console.log(`   📅 ${row.start_Date} até ${row.end_Date}`);
        console.log(`   🆔 ID: ${row.booking_id}`);
        console.log(`   📦 SKU: ${row.sku_code}`);
        console.log('');
      });
    } else {
      console.log('❌ Nenhuma reserva Honda encontrada para maio 2025');
    }
  })
  .catch(console.error);
