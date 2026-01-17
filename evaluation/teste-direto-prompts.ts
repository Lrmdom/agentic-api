import fs from 'fs';

// Teste direto e simples para verificar se os prompts funcionam
const dados = JSON.parse(fs.readFileSync('./indice-numerico.json', 'utf8'));

function testarPrompt(prompt: string, modelo?: string) {
  console.log(`\n🔍 TESTE: "${prompt}" ${modelo ? `(modelo: ${modelo})` : ''}`);
  
  const resultados = dados.dados.filter((dado: any) => {
    const queryLower = prompt.toLowerCase();
    const contextoLower = dado.contexto.toLowerCase();
    const especificacaoLower = dado.especificacao.toLowerCase();
    const modeloLower = dado.modelo.toLowerCase();
    
    // Busca simples e direta
    return contextoLower.includes(queryLower) || 
           especificacaoLower.includes(queryLower) ||
           (modelo && modeloLower.includes(modelo.toLowerCase()));
  });
  
  if (resultados.length > 0) {
    console.log(`✅ ENCONTRADOS ${resultados.length} resultados:`);
    resultados.slice(0, 3).forEach((r: any, idx) => {
      console.log(`  ${idx + 1}. ${r.especificacao}: ${r.valor} ${r.unidade} (${r.modelo})`);
      console.log(`     Contexto: ${r.contexto.substring(0, 100)}...`);
    });
  } else {
    console.log('❌ NENHUM DADO ENCONTRADO');
  }
  
  return resultados;
}

// Testar os prompts que você tentou
console.log('🚀 TESTANDO SEUS PROMPTS ANTERIORES\n');

testarPrompt('Qual a pressão dos pneus da Honda Forza 350?', 'Honda Forza 350');
testarPrompt('Qual a pressão dos pneus', 'Honda Forza 350');
testarPrompt('pressao', 'Honda Forza 350');
testarPrompt('kpa', 'Honda Forza 350');
testarPrompt('psi', 'Honda Forza 350');

console.log('\n🎯 TESTANDO FOLGA (DEVE FUNCIONAR)\n');
testarPrompt('Qual a folga do acelerador da Honda Forza 125?', 'Honda Forza 125');
testarPrompt('folga', 'Honda Forza 125');
testarPrompt('acelerador', 'Honda Forza 125');
