import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

const credentialsJson = JSON.parse(fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8'));
const bq = new BigQuery({
  projectId: 'avid-infinity-370500',
  credentials: credentialsJson
});

console.log('🔍 Comparando nomes de modelos...');

Promise.all([
  bq.query("SELECT DISTINCT title FROM `avid-infinity-370500.events_data_dataset.master_catalog_rag` WHERE title LIKE '%PCX%' LIMIT 5"),
  bq.query("SELECT DISTINCT vehicleModel FROM `avid-infinity-370500.events_data_dataset.events-data-table` WHERE vehicleModel LIKE '%PCX%' LIMIT 5")
]).then(([catalog, events]) => {
  console.log('\n📋 Nomes no Catálogo:');
  catalog[0].forEach((row: any) => console.log(`- "${row.title}"`));
  
  console.log('\n📋 Nomes nos Eventos:');
  events[0].forEach((row: any) => console.log(`- "${row.vehicleModel}"`));
  
  console.log('\n🔍 Verificando correspondências exatas...');
}).catch(console.error);
