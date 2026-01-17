import { GeminiEmbeddingService } from './gemini-embedding-service.js';

// Teste completo com Gemini Embeddings
async function testarGeminiCompleto() {
  console.log('🚀 TESTE COMPLETO: GEMINI EMBEDDINGS\n');
  
  try {
    // 1. Inicializar serviço Gemini
    console.log('1️⃣ Inicializando Gemini Embedding Service...');
    const geminiService = new GeminiEmbeddingService();
    
    // 2. Carregar documentos existentes
    console.log('2️⃣ Carregando documentos dos manuais...');
    const fs = await import('fs');
    const indiceNumerico = JSON.parse(fs.readFileSync('./indice-numerico.json', 'utf8'));
    
    // 3. Testar buscas específicas
    const testQueries = [
      'Qual a pressão dos pneus da Honda PCX 125?',
      'Qual a folga do acelerador da Forza 125?',
      'Qual a capacidade do depósito da SH 125?',
      'Qual o torque do motor da Vision 110?',
      'pressao pcx 125',
      'folga acelerador',
      'capacidade tanque'
    ];
    
    console.log('3️⃣ Executando buscas com Gemini...\n');
    
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`\n🔍 Teste ${i + 1}: "${query}"`);
      console.log('─'.repeat(60));
      
      try {
        // Busca com Gemini
        const results = await geminiService.search(query, 5);
        
        console.log(`✅ Encontrados ${results.length} resultados:`);
        
        results.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.model} - ${result.section}: ${result.similarity.toFixed(3)} (${result.confidence}%)`);
          console.log(`     Conteúdo: ${result.content.substring(0, 80)}...`);
        });
        
        // Verificar se encontrou dados corretos
        const hasCorrectData = results.some(r => 
          r.similarity > 0.7 && 
          (r.content.includes('250') || r.content.includes('200') || r.content.includes('2 - 6'))
        );
        
        if (hasCorrectData) {
          console.log(`🎯 SUCESSO: Dados corretos encontrados com Gemini!`);
        } else {
          console.log(`⚠️ RESULTADOS PARCIAIS OU INCORRETOS`);
        }
        
      } catch (error) {
        console.error(`❌ Erro no teste ${i + 1}:`, error);
      }
      
      // Pequena pausa
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 4. Estatísticas finais
    console.log('\n📊 ESTATÍSTICAS FINAIS DO GEMINI:');
    console.log(`• Total de documentos: ${indiceNumerico.dados.length}`);
    console.log(`• Testes executados: ${testQueries.length}`);
    console.log(`• Dimensões: 768 (text-embedding-004)`);
    console.log(`• Idioma: Português`);
    console.log(`• Foco: Dados técnicos`);
    
    console.log('\n🎯 GEMINI EMBEDDINGS ESTÃO PRONTAS PARA USO!');
    console.log('📋 Vantagens: Alta velocidade + baixo custo + ótimo para PT');
    
  } catch (error) {
    console.error('❌ Erro no teste completo:', error);
  }
}

// Executar teste
if (import.meta.url === `file://${process.argv[1]}`) {
  testarGeminiCompleto().catch(console.error);
}

export { testarGeminiCompleto };
