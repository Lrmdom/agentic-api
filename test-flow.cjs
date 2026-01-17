const { marketingFlow } = require('./dist/genkit-flow.cjs');

async function testFlow() {
  console.log('🧪 Testando flow otimizado...');
  
  // Test 1: Pergunta técnica (deve ativar manual tool)
  console.log('\n1. Teste pergunta técnica:');
  try {
    const result1 = await marketingFlow('Qual a pressão dos pneus da PCX 125?');
    console.log('✅ Resultado:', result1);
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
  
  // Test 2: Pergunta de catálogo (deve ativar catalog tool)
  console.log('\n2. Teste pergunta catálogo:');
  try {
    const result2 = await marketingFlow('Qual o preço da Honda Forza 350?');
    console.log('✅ Resultado:', result2);
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
  
  // Test 3: Conversa geral (não deve ativar ferramentas)
  console.log('\n3. Teste conversa geral:');
  try {
    const result3 = await marketingFlow('Olá, tudo bem?');
    console.log('✅ Resultado:', result3);
  } catch (error) {
    console.log('❌ Erro:', error.message);
  }
}

testFlow().catch(console.error);
