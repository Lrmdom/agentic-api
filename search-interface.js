import { FinalIndexer } from './src/final-indexer.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function searchInterface() {
  const indexer = new FinalIndexer();
  const index = await indexer.loadIndex();
  
  if (!index) {
    console.log('❌ Índice não encontrado. Execute "npx tsx build-final-index.js" primeiro.');
    rl.close();
    return;
  }

  console.log('\n🔍 Sistema de Busca de Manuais de Motos Honda');
  console.log('==========================================');
  console.log('Modelos disponíveis:');
  const models = [...new Set(index.documents.map(d => d.metadata.brand + ' ' + d.model))];
  models.forEach(model => console.log(`  - ${model}`));
  console.log('\nComandos:');
  console.log('  -Digite sua busca para pesquisar');
  console.log('  -"modelo: [nome]" para ver informações de um modelo específico');
  console.log('  -"specs: [nome]" para ver especificações de um modelo');
  console.log('  -"features: [nome]" para ver funcionalidades de um modelo');
  console.log('  -"sair" para encerrar');
  console.log('==========================================\n');

  function askQuestion() {
    rl.question('🔎 Busca: ', async (input) => {
      const query = input.trim().toLowerCase();
      
      if (query === 'sair') {
        console.log('\n👋 Até logo!');
        rl.close();
        return;
      }

      if (!query) {
        askQuestion();
        return;
      }

      try {
        let results = [];

        if (query.startsWith('modelo:')) {
          const modelName = query.replace('modelo:', '').trim();
          results = indexer.getModelInfo(modelName, index);
          console.log(`\n📋 Informações do modelo: ${modelName}`);
        } else if (query.startsWith('specs:')) {
          const modelName = query.replace('specs:', '').trim();
          results = indexer.getSpecifications(modelName, index);
          console.log(`\n📊 Especificações de: ${modelName}`);
        } else if (query.startsWith('features:')) {
          const modelName = query.replace('features:', '').trim();
          results = indexer.getFeatures(modelName, index);
          console.log(`\n🚀 Funcionalidades de: ${modelName}`);
        } else {
          results = indexer.search(query, index);
          console.log(`\n🔍 Resultados para: "${query}"`);
        }

        if (results.length === 0) {
          console.log('❌ Nenhum resultado encontrado.');
        } else {
          console.log(`✅ Encontrados ${results.length} resultados:\n`);
          
          results.forEach((result, index) => {
            console.log(`${index + 1}. ${result.model} - ${result.section}`);
            console.log(`   Tipo: ${result.type === 'specifications' ? '📋 Especificações' : '🚀 Funcionalidades'}`);
            
            // Mostrar trecho do conteúdo
            const preview = result.content.substring(0, 200);
            console.log(`   Preview: ${preview}${result.content.length > 200 ? '...' : ''}`);
            console.log(`   Palavras-chave: ${result.keywords.slice(0, 5).join(', ')}${result.keywords.length > 5 ? '...' : ''}`);
            console.log('');
          });
        }
        
        console.log('─'.repeat(50));
        
      } catch (error) {
        console.error('❌ Erro na busca:', error.message);
      }

      askQuestion();
    });
  }

  askQuestion();
}

searchInterface().catch(console.error);
