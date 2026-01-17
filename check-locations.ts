import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

const credentialsJson = JSON.parse(fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8'));
const bq = new BigQuery({
  projectId: 'avid-infinity-370500',
  credentials: credentialsJson
});

console.log('🔍 Verificando localizações...');

Promise.all([
  bq.query("SELECT DISTINCT JSON_VALUE(content_json, '$.vehicleModels[0].vehicles[0].location.name') as location FROM `avid-infinity-370500.events_data_dataset.master_catalog_rag` WHERE title LIKE '%PCX%' LIMIT 5"),
  bq.query("SELECT DISTINCT store_location FROM `avid-infinity-370500.events_data_dataset.events-data-table` WHERE vehicleModel LIKE '%PCX%' LIMIT 5")
]).then(([catalog, events]) => {
  console.log('\n📋 Localizações no Catálogo:');
  catalog[0].forEach((row: any) => console.log(`- "${row.location}"`));
  
  console.log('\n📋 Localizações nos Eventos:');
  events[0].forEach((row: any) => console.log(`- "${row.store_location}"`));
}).catch(console.error);
