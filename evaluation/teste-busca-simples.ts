import fs from 'fs';

// Teste simples e direto da busca no índice
async function testeBuscaSimples() {
  console.log('🔍 TESTE SIMPLES DE BUSCA NO ÍNDICE');
  console.log('='.repeat(50));
  
  try {
    // Carregar o índice
    const indiceData = JSON.parse(fs.readFileSync('./indice-numerico.json', 'utf8'));
    const dados = indiceData.dados;
    
    console.log(`📊 Índice carregado: ${dados.length} dados numéricos`);
    
    // Testes específicos
    const testes = [
      { query: 'folga', tipo: 'folga' },
      { query: 'acelerador', tipo: 'folga' },
      { query: 'pressao', tipo: 'pressao' },
      { query: 'kpa', tipo: 'pressao' },
      { query: 'capacidade', tipo: 'capacidade' },
      { query: 'torque', tipo: 'torque' }
    ];
    
    for (const teste of testes) {
      console.log(`\n🔍 Buscando: "${teste.query}" (tipo: ${teste.tipo})`);
      
      // Buscar no índice
      const resultados = dados.filter((dado: any) => {
        const queryLower = teste.query.toLowerCase();
        return dado.tipo === teste.tipo || 
               dado.contexto.toLowerCase().includes(queryLower) ||
               dado.especificacao.toLowerCase().includes(queryLower);
      });
      
      console.log(`  ✅ Encontrados: ${resultados.length} resultados`);
      
      // Mostrar os 3 primeiros
      resultados.slice(0, 3).forEach((r: any, idx) => {
        console.log(`    ${idx + 1}. ${r.especificacao}: ${r.valor} ${r.unidade} (${r.modelo})`);
        console.log(`       Página: ${r.pagina}`);
      });
      
      if (resultados.length > 3) {
        console.log(`    ... +${resultados.length - 3} resultados`);
      }
    }
    
    // Teste específico para folga do acelerador
    console.log('\n🎯 TESTE ESPECÍFICO: Folga do Acelerador');
    const folgaAcelerador = dados.filter((d: any) => 
      d.tipo === 'folga' && 
      (d.contexto.toLowerCase().includes('acelerador') || 
       d.contexto.toLowerCase().includes('punho'))
    );
    
    console.log(`✅ Folga do acelerador encontrados: ${folgaAcelerador.length}`);
    folgaAcelerador.forEach((r: any) => {
      console.log(`  • ${r.modelo}: ${r.valor} ${r.unidade} (Página ${r.pagina})`);
    });
    
    // Teste específico para pressão
    console.log('\n🎯 TESTE ESPECÍFICO: Pressão dos Pneus');
    const pressaoPneus = dados.filter((d: any) => 
      d.tipo === 'pressao' && 
      (d.contexto.toLowerCase().includes('pneu') || 
       d.contexto.toLowerCase().includes('traseiro') ||
       d.contexto.toLowerCase().includes('dianteiro'))
    );
    
    console.log(`✅ Pressão dos pneus encontrados: ${pressaoPneus.length}`);
    pressaoPneus.forEach((r: any) => {
      console.log(`  • ${r.modelo}: ${r.valor} ${r.unidade} (Página ${r.pagina})`);
    });
    
    console.log('\n🎯 RESUMO DOS TESTES:');
    console.log(`  • Índice funcional: ✅`);
    console.log(`  • Dados de folga: ${dados.filter((d: any) => d.tipo === 'folga').length}`);
    console.log(`  • Dados de pressão: ${dados.filter((d: any) => d.tipo === 'pressao').length}`);
    console.log(`  • Dados de capacidade: ${dados.filter((d: any) => d.tipo === 'capacidade').length}`);
    console.log(`  • Dados de torque: ${dados.filter((d: any) => d.tipo === 'torque').length}`);
    
  } catch (error) {
    console.error('❌ Erro no teste simples:', error);
  }
}

// Executar teste
testeBuscaSimples();
