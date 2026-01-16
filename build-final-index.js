import { SimpleExtractor } from './src/simple-extractor.js';
import { FinalIndexer } from './src/final-indexer.js';

async function main() {
  console.log('🚀 Iniciando sistema completo de indexação seletiva...\n');
  
  // 1. Extrair conteúdo relevante dos PDFs
  console.log('📄 Etapa 1: Extraindo conteúdo relevante dos PDFs...');
  const extractor = new SimpleExtractor();
  const documents = await extractor.processAllPdfs();
  console.log(`✅ ${documents.length} documentos processados\n`);

  // 2. Construir índice seletivo
  console.log('🔍 Etapa 2: Construindo índice seletivo...');
  const indexer = new FinalIndexer();
  const searchIndex = indexer.buildSearchIndex(documents);
  
  // 3. Salvar índice
  console.log('💾 Etapa 3: Salvando índice...');
  await indexer.saveIndex(searchIndex);
  
  console.log('\n🎉 Sistema de indexação concluído com sucesso!');
  
  // 4. Mostrar estatísticas detalhadas
  const stats = {
    totalDocuments: searchIndex.documents.length,
    totalKeywords: searchIndex.keywordsIndex.size,
    models: [...new Set(searchIndex.documents.map(d => d.metadata.brand + ' ' + d.model))],
    typeDistribution: {
      specifications: searchIndex.documents.filter(d => d.type === 'specifications').length,
      features: searchIndex.documents.filter(d => d.type === 'features').length
    }
  };
  
  console.log('\n📈 Estatísticas Detalhadas:');
  console.log(JSON.stringify(stats, null, 2));
  
  // 5. Testar buscas
  console.log('\n🔍 Testes de Busca:');
  
  const testQueries = [
    'especificações motor',
    'abs travões',
    'keyless smart key',
    'consumo depósito',
    'suspensão'
  ];
  
  for (const query of testQueries) {
    const results = indexer.search(query, searchIndex);
    console.log(`\n🔎 Busca: "${query}"`);
    console.log(`   Resultados: ${results.length}`);
    results.slice(0, 2).forEach(result => {
      console.log(`   - ${result.model}: ${result.section}`);
    });
  }
  
  console.log('\n✨ Sistema pronto para uso!');
}

main().catch(console.error);
