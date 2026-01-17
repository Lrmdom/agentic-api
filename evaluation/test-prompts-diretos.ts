import fs from 'fs';
import path from 'path';

// Teste direto nos arquivos markdown para contornar problemas do MCP
const MODELOS = {
  'forza 125': 'Honda_Forza_125.md',
  'sh 125': 'Honda_SH_125.md',
  'pcx 125': 'Honda_PCX_125.md',
  'vision 110': 'Honda_Vision_110.md',
  'cbr 650r': 'Honda_Forza_350.md'
};

const TEST_PROMPTS_DIRETOS = [
  {
    categoria: 'folga',
    prompts: [
      'folga do acelerador',
      'folga no punho do acelerador',
      'flange do punho',
      'regulagem do acelerador',
      'jogo do acelerador'
    ]
  },
  {
    categoria: 'binario',
    prompts: [
      'torque de aperto',
      'valor de torque',
      'binário de aperto',
      'aperto do motor',
      'parafuso cabeçote'
    ]
  },
  {
    categoria: 'pressao',
    prompts: [
      'pressão dos pneus',
      'calibragem dos pneus',
      'pressão de pneu',
      'inflação dos pneus',
      'pressão recomendada'
    ]
  }
];

function extrairValoresNumericos(text: string): string[] {
  const patterns = [
    /\d+[\.,]?\d*\s*-\s*\d+[\.,]?\d*\s*mm/gi,
    /\d+[\.,]?\d*\s*mm/gi,
    /\d+[\.,]?\d*\s*Nm/gi,
    /\d+[\.,]?\d*\s*kgf·m/gi,
    /\d+[\.,]?\d*\s*bar/gi,
    /\d+[\.,]?\d*\s*psi/gi
  ];
  
  const valores: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      valores.push(...matches);
    }
  });
  
  return [...new Set(valores)]; // Remover duplicados
}

function buscarNoArquivo(modelo: string, prompt: string): any {
  const filename = (MODELOS as Record<string, string>)[modelo.toLowerCase()];
  if (!filename) {
    return { encontrado: false, motivo: 'Modelo não mapeado' };
  }
  
  const filePath = path.join('./markdown', filename);
  if (!fs.existsSync(filePath)) {
    return { encontrado: false, motivo: 'Arquivo não encontrado' };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Buscar por palavras-chave do prompt
  const keywords = prompt.toLowerCase().split(' ').filter(w => w.length > 2);
  let linhasRelevantes: string[] = [];
  
  content.split('\n').forEach((linha, index) => {
    const linhaLower = linha.toLowerCase();
    if (keywords.some(keyword => linhaLower.includes(keyword))) {
      // Pegar a linha e algumas linhas ao redor para contexto
      const start = Math.max(0, index - 2);
      const end = Math.min(content.split('\n').length - 1, index + 2);
      const contexto = content.split('\n').slice(start, end + 1).join(' ');
      linhasRelevantes.push(contexto);
    }
  });
  
  const textoRelevante = linhasRelevantes.join('\n');
  const valoresNumericos = extrairValoresNumericos(textoRelevante);
  
  return {
    encontrado: linhasRelevantes.length > 0,
    linhasRelevantes: linhasRelevantes.slice(0, 3), // Limitar para não poluir
    valoresNumericos,
    temDadosNumericos: valoresNumericos.length > 0,
    contexto: textoRelevante.length > 500 ? textoRelevante.substring(0, 500) + '...' : textoRelevante
  };
}

async function executarTestesDiretos() {
  console.log('🚀 EXECUTANDO TESTES DIRETOS NOS ARQUIVOS');
  console.log('='.repeat(80));
  
  const resultados: any[] = [];
  
  for (const [modelo, filename] of Object.entries(MODELOS)) {
    console.log(`\n\n📱 MODELO: ${modelo.toUpperCase()} (${filename})`);
    console.log('─'.repeat(60));
    
    for (const teste of TEST_PROMPTS_DIRETOS) {
      console.log(`\n🔍 CATEGORIA: ${teste.categoria.toUpperCase()}`);
      
      for (const prompt of teste.prompts) {
        console.log(`\n  ❓ "${prompt}"`);
        
        const resultado = buscarNoArquivo(modelo, prompt);
        
        if (resultado.encontrado) {
          console.log(`    ✅ Encontrado em ${resultado.linhasRelevantes.length} contexto(s)`);
          
          if (resultado.temDadosNumericos) {
            console.log(`    📊 Valores: ${resultado.valoresNumericos.join(', ')}`);
            
            // Verificar se é o valor esperado (2 - 6 mm para folga)
            if (teste.categoria === 'folga' && resultado.valoresNumericos.some((v: string) => v.includes('2') && v.includes('6'))) {
              console.log(`    🎯 VALOR ESPERADO ENCONTRADO!`);
            }
          } else {
            console.log(`    ❌ Sem dados numéricos relevantes`);
          }
          
          // Mostrar uma linha de contexto
          if (resultado.linhasRelevantes.length > 0) {
            console.log(`    📝 Contexto: "${resultado.linhasRelevantes[0].substring(0, 100)}..."`);
          }
        } else {
          console.log(`    ❌ Não encontrado: ${resultado.motivo}`);
        }
        
        resultados.push({
          modelo,
          categoria: teste.categoria,
          prompt,
          ...resultado
        });
      }
    }
  }
  
  // Gerar estatísticas finais
  console.log('\n\n📊 ESTATÍSTICAS FINAIS');
  console.log('='.repeat(80));
  
  const stats: Record<string, any> = {};
  
  for (const teste of TEST_PROMPTS_DIRETOS) {
    const categoriaResultados = resultados.filter(r => r.categoria === teste.categoria);
    const encontrados = categoriaResultados.filter(r => r.encontrado).length;
    const comDadosNumericos = categoriaResultados.filter(r => r.temDadosNumericos).length;
    
    stats[teste.categoria] = {
      total: categoriaResultados.length,
      encontrados,
      taxaEncontro: Math.round((encontrados / categoriaResultados.length) * 100),
      comDadosNumericos,
      taxaDadosNumericos: Math.round((comDadosNumericos / categoriaResultados.length) * 100)
    };
    
    console.log(`\n📌 ${teste.categoria.toUpperCase()}:`);
    console.log(`  • Encontrados: ${encontrados}/${categoriaResultados.length} (${stats[teste.categoria].taxaEncontro}%)`);
    console.log(`  • Com dados numéricos: ${comDadosNumericos}/${categoriaResultados.length} (${stats[teste.categoria].taxaDadosNumericos}%)`);
  }
  
  // Salvar resultados
  const relatorio = {
    timestamp: new Date().toISOString(),
    estatisticas: stats,
    resultadosDetalhados: resultados
  };
  
  fs.writeFileSync('./test-results-diretos.json', JSON.stringify(relatorio, null, 2));
  console.log(`\n📄 Resultados salvos em: ./test-results-diretos.json`);
  
  return relatorio;
}

// Executar testes diretos
executarTestesDiretos().catch(console.error);
