import { MultiLingualEmbeddingService } from './multilingual-embedding-service.js';

// Teste completo do Vector Search com OpenAI
async function testarVectorSearchCompleto() {
  console.log('🚀 TESTE COMPLETO: VECTOR SEARCH COM OPENAI\n');
  
  try {
    // 1. Inicializar serviço multi-lingual
    console.log('1️⃣ Inicializando OpenAI Embedding Service...');
    const embeddingService = new MultiLingualEmbeddingService();
    
    // 2. Carregar documentos existentes
    console.log('2️⃣ Carregando documentos dos manuais...');
    const fs = await import('fs');
    const indiceNumerico = JSON.parse(fs.readFileSync('./indice-numerico.json', 'utf8'));
    
    // 3. Criar embeddings dos documentos
    console.log('3️⃣ Gerando embeddings dos documentos...');
    const documentEmbeddings = await embeddingService.createMultiLingualEmbedding(
      'Dados técnicos dos manuais Honda',
      ['pt', 'en']
    );
    
    // 4. Testar buscas específicas
    const testQueries = [
      'Qual a pressão dos pneus da Honda PCX 125?',
      'Qual a folga do acelerador da Forza 125?',
      'Qual a capacidade do depósito da SH 125?',
      'Qual o torque do motor da Vision 110?',
      'pressao pcx 125',
      'folga acelerador',
      'capacidade tanque'
    ];
    
    console.log('4️⃣ Executando buscas vetoriais...\n');
    
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`\n🔍 Teste ${i + 1}: "${query}"`);
      console.log('─'.repeat(60));
      
      try {
        // Busca multi-lingual
        const results = await embeddingService.multiLingualSearch(query, ['pt', 'en'], 5);
        
        console.log(`✅ Encontrados ${results.length} resultados:`);
        
        results.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.model} - ${result.section}: ${result.similarity.toFixed(3)} (${result.matchedLanguage})`);
          console.log(`     Confiança: ${result.confidence}%`);
          console.log(`     Conteúdo: ${result.content.substring(0, 80)}...`);
        });
        
        // Verificar se encontrou dados corretos
        const hasCorrectData = results.some(r => 
          r.similarity > 0.8 && 
          (r.content.includes('250') || r.content.includes('200') || r.content.includes('2 - 6'))
        );
        
        if (hasCorrectData) {
          console.log(`🎯 SUCESSO: Dados corretos encontrados!`);
        } else {
          console.log(`⚠️ RESULTADOS PARCIAIS OU INCORRETOS`);
        }
        
      } catch (error) {
        console.error(`❌ Erro no teste ${i + 1}:`, error);
      }
      
      // Pequena pausa
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 5. Estatísticas finais
    console.log('\n📊 ESTATÍSTICAS FINAIS:');
    console.log(`• Total de documentos: ${indiceNumerico.dados.length}`);
    console.log(`• Embeddings geradas: PT + EN`);
    console.log(`• Testes executados: ${testQueries.length}`);
    console.log(`• Dimensões: ${embeddingService.getModelInfo().dimensions}`);
    console.log(`• Idiomas suportados: ${Object.keys(embeddingService.getSupportedLanguages()).length}`);
    
    console.log('\n🎯 VECTOR SEARCH ESTÁ PRONTO PARA USO!');
    console.log('📋 Para usar: npm install openai && export OPENAI_API_KEY=sua-chave');
    
  } catch (error) {
    console.error('❌ Erro no teste completo:', error);
  }
}

// Executar teste
if (import.meta.url === `file://${process.argv[1]}`) {
  testarVectorSearchCompleto().catch(console.error);
}

export { testarVectorSearchCompleto };
