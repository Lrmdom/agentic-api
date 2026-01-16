import { SimpleExtractor } from './src/simple-extractor.js';

async function main() {
  const extractor = new SimpleExtractor();
  
  console.log('🚀 Iniciando extração simplificada...\n');
  
  const documents = await extractor.processAllPdfs();
  
  console.log(`\n📊 Resultados:`);
  console.log(`- Documentos processados: ${documents.length}`);
  
  documents.forEach(doc => {
    console.log(`- ${doc.model}:`);
    console.log(`  - Especificações: ${doc.specifications.length > 0 ? '✅' : '❌'}`);
    console.log(`  - Funcionalidades: ${doc.keyFeatures.length > 0 ? '✅' : '❌'}`);
  });
}

main().catch(console.error);
