import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

const credentialsJson = JSON.parse(fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8'));
const bq = new BigQuery({
  projectId: 'avid-infinity-370500',
  credentials: credentialsJson
});

console.log('🔍 Testando correspondência manual...');

bq.query(`
  SELECT 
    'Honda PCX 125' as catalog_model,
    'Pcx 125 cc.  pt' as event_model,
    LOWER('Honda PCX 125') as lower_catalog,
    LOWER('Pcx 125 cc.  pt') as lower_event,
    REPLACE('Pcx 125 cc.  pt', ' ', '') as event_no_spaces,
    LOWER('Honda PCX 125') LIKE LOWER('%' || REPLACE('Pcx 125 cc.  pt', ' ', '') || '%') as match1,
    LOWER('Pcx 125 cc.  pt') LIKE LOWER('%' || REPLACE('Honda PCX 125', ' ', '') || '%') as match2
`)
  .then(([rows]) => {
    console.log('\n📊 Teste de correspondência:');
    console.log(JSON.stringify(rows[0], null, 2));
  })
  .catch(console.error);
