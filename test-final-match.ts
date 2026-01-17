import { BigQuery } from '@google-cloud/bigquery';
import * as fs from 'fs';

const credentialsJson = JSON.parse(fs.readFileSync('avid-infinity-370500-d9f7e84d26a4.json', 'utf8'));
const bq = new BigQuery({
  projectId: 'avid-infinity-370500',
  credentials: credentialsJson
});

console.log('🔍 Teste final de correspondência...');

bq.query(`
  SELECT 
    'Honda PCX 125' as catalog_model,
    'Pcx 125 cc.  pt' as event_model,
    LOWER('Honda PCX 125') as catalog_lower,
    LOWER('Pcx 125 cc.  pt') as event_lower,
    LOWER('Honda PCX 125') LIKE '%pcx%' as catalog_has_pcx,
    LOWER('Pcx 125 cc.  pt') LIKE '%pcx%' as event_has_pcx,
    CASE 
      WHEN (LOWER('Honda PCX 125') LIKE '%pcx%' AND LOWER('Pcx 125 cc.  pt') LIKE '%pcx%')
      THEN 'MATCH'
      ELSE 'NO MATCH'
    END as result
`)
  .then(([rows]) => {
    console.log('\n📊 Resultado do teste:');
    console.log(JSON.stringify(rows[0], null, 2));
  })
  .catch(console.error);
