import { IndexManager } from './src/index-manager.js';

async function main() {
  const indexManager = new IndexManager();
  
  try {
    await indexManager.buildFullIndex();
    
    // Mostrar estatísticas
    const stats = await indexManager.getIndexStats();
    console.log('\n📈 Estatísticas do Índice:');
    console.log(JSON.stringify(stats, null, 2));
    
  } catch (error) {
    console.error('❌ Erro durante a indexação:', error);
    process.exit(1);
  }
}

main();
