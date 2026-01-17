import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

const credentialsJson = JSON.parse(fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8'));
const bq = new BigQuery({
  projectId: 'avid-infinity-370500',
  credentials: credentialsJson
});

console.log('🔍 Verificando todos os modelos nos eventos...');

bq.query("SELECT DISTINCT vehicleModel FROM `avid-infinity-370500.events_data_dataset.events-data-table` WHERE vehicleModel IS NOT NULL ORDER BY vehicleModel LIMIT 20")
  .then(([rows]) => {
    console.log(`\n📋 Todos os modelos nos eventos (${rows.length}):`);
    rows.forEach((row: any, i: number) => {
      console.log(`${i+1}. "${row.vehicleModel}"`);
    });
  })
  .catch(console.error);
