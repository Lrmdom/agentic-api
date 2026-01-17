import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

const credentialsJson = JSON.parse(fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8'));
const bq = new BigQuery({
  projectId: 'avid-infinity-370500',
  credentials: credentialsJson
});

console.log('🔍 Verificando reservas que existem...');

bq.query("SELECT vehicleModel, store_location, start_Date, end_Date FROM `avid-infinity-370500.events_data_dataset.events-data-table` WHERE status = 'approved' ORDER BY start_Date DESC LIMIT 5")
  .then(([rows]) => {
    console.log(`\n📋 Últimas reservas (${rows.length}):`);
    rows.forEach((row: any, i: number) => {
      console.log(`${i+1}. ${row.vehicleModel} - ${row.store_location} (${row.start_Date} até ${row.end_Date})`);
    });
  })
  .catch(console.error);
