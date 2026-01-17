import fs from 'fs';

// Teste específico para PCX 125
const dados = JSON.parse(fs.readFileSync('./indice-numerico.json', 'utf8'));

console.log('🔍 TESTE ESPECÍFICO: PCX 125\n');

// Buscar dados da PCX 125
const dadosPCX = dados.dados.filter((dado: any) => 
  dado.modelo.toLowerCase().includes('pcx 125')
);

console.log(`📊 Total de dados PCX 125: ${dadosPCX.length}\n`);

// Agrupar por tipo
const porTipo: Record<string, any[]> = {};
dadosPCX.forEach(dado => {
  if (!porTipo[dado.tipo]) {
    porTipo[dado.tipo] = [];
  }
  porTipo[dado.tipo].push(dado);
});

// Mostrar dados organizados
for (const [tipo, itens] of Object.entries(porTipo)) {
  console.log(`\n📋 ${tipo.toUpperCase()}:`);
  itens.forEach((item: any, idx) => {
    console.log(`  ${idx + 1}. ${item.especificacao}: ${item.valor} ${item.unidade}`);
    console.log(`     Contexto: ${item.contexto.substring(0, 100)}...`);
    console.log(`     Página: ${item.pagina}`);
  });
}

// Testar busca específica
console.log('\n🔍 TESTANDO BUSCA ESPECÍFICA:\n');

const queries = [
  'Qual a pressão dos pneus da Honda PCX 125?',
  'pressao pcx 125',
  'kpa pcx 125',
  'psi pcx 125',
  'pneu pcx 125'
];

queries.forEach((query, idx) => {
  console.log(`\n❓ Query ${idx + 1}: "${query}"`);
  
  // Simular busca do método buscarDadosNumericos
  const resultados = dadosPCX.filter((dado: any) => {
    const queryLower = query.toLowerCase();
    const contextoLower = dado.contexto.toLowerCase();
    const especificacaoLower = dado.especificacao.toLowerCase();
    
    return contextoLower.includes(queryLower) || 
           especificacaoLower.includes(queryLower) ||
           (queryLower.includes('pressao') && (
             contextoLower.includes('pneu') || 
             contextoLower.includes('traseiro') ||
             contextoLower.includes('dianteiro') ||
             especificacaoLower.includes('pressão')
           )) ||
           (queryLower.includes('kpa') && contextoLower.includes('kpa')) ||
           (queryLower.includes('psi') && contextoLower.includes('psi'));
  });
  
  console.log(`  ✅ Encontrados: ${resultados.length}`);
  if (resultados.length > 0) {
    resultados.slice(0, 2).forEach((r: any, i) => {
      console.log(`    ${i + 1}. ${r.especificacao}: ${r.valor} ${r.unidade}`);
    });
  } else {
    console.log('    ❌ Nenhum resultado');
  }
});

console.log('\n🎯 CONCLUSÃO:');
console.log('✅ Dados da PCX 125 existem no índice');
console.log('❌ Mas a busca pode não estar encontrando pelo nome completo');
console.log('🔧 Sugestão: Usar "pcx" em vez de "pcx 125" na busca');
