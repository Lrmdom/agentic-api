import fs from 'fs';
import path from 'path';

interface EspecificacaoTecnica {
  modelo: string;
  categoria: string;
  especificacao: string;
  valor: string;
  unidade: string;
  pagina: string;
  contexto: string;
  precisao: 'exata' | 'aproximada' | 'incompleta';
  fonte: string;
}

function extrairTodasEspecificacoes(): EspecificacaoTecnica[] {
  const modelos: Record<string, string> = {
    'forza 125': 'Honda_Forza_125.md',
    'sh 125': 'Honda_SH_125.md', 
    'pcx 125': 'Honda_PCX_125.md',
    'vision 110': 'Honda_Vision_110.md',
    'cbr 650r': 'Honda_Forza_350.md'
  };

  const especificacoes: EspecificacaoTecnica[] = [];

  // Padrões abrangentes para encontrar TODOS os dados técnicos
  const padroes = [
    {
      categoria: 'Folga',
      regex: /folga[^:]*:?\s*(\d+(?:\s*-\s*\d+)?)[\s]*mm/gi,
      unidade: 'mm'
    },
    {
      categoria: 'Dimensão',
      regex: /(\d+(?:\s*-\s*\d+)?)[\s]*mm(?![^]*folga)/gi,
      unidade: 'mm'
    },
    {
      categoria: 'Capacidade',
      regex: /(\d+(?:\.\d+)?)[\s]*(l|litros|ml)/gi,
      unidade: 'L'
    },
    {
      categoria: 'Peso',
      regex: /(\d+(?:\.\d+)?)[\s]*kg/gi,
      unidade: 'kg'
    },
    {
      categoria: 'Velocidade',
      regex: /(\d+(?:\.\d+)?)[\s]*km\/h/gi,
      unidade: 'km/h'
    },
    {
      categoria: 'Potência',
      regex: /(\d+(?:\.\d+)?)[\s]*(kw|cv|hp)/gi,
      unidade: 'kW'
    },
    {
      categoria: 'Rotação',
      regex: /(\d+(?:\.\d+)?)[\s]*rpm/gi,
      unidade: 'rpm'
    },
    {
      categoria: 'Temperatura',
      regex: /(\d+(?:\.\d+)?)[\s]*°[cC]/gi,
      unidade: '°C'
    },
    {
      categoria: 'Pressão',
      regex: /(\d+(?:\.\d+)?)[\s]*(bar|psi|kPa)/gi,
      unidade: 'bar'
    },
    {
      categoria: 'Torque',
      regex: /(\d+(?:\.\d+)?)[\s]*(Nm|kgf·m)/gi,
      unidade: 'Nm'
    },
    {
      categoria: 'Voltagem',
      regex: /(\d+(?:\.\d+)?)[\s]*V/gi,
      unidade: 'V'
    },
    {
      categoria: 'Corrente',
      regex: /(\d+(?:\.\d+)?)[\s]*A/gi,
      unidade: 'A'
    },
    {
      categoria: 'Potência Elétrica',
      regex: /(\d+(?:\.\d+)?)[\s]*W/gi,
      unidade: 'W'
    }
  ];

  for (const [modeloNome, arquivo] of Object.entries(modelos)) {
    const filePath = path.join('./markdown', arquivo);
    
    if (!fs.existsSync(filePath)) continue;
    
    const content = fs.readFileSync(filePath, 'utf8');
    const linhas = content.split('\n');
    
    for (const padrao of padroes) {
      let match;
      while ((match = padrao.regex.exec(content)) !== null) {
        const valor = match[1];
        const startIndex = Math.max(0, match.index - 100);
        const endIndex = Math.min(content.length, match.index + match[0].length + 100);
        const contexto = content.substring(startIndex, endIndex).replace(/\s+/g, ' ').trim();
        
        // Encontrar a página
        let pagina = 'N/A';
        const paginaMatch = contexto.match(/Página\s*(\d+)/i);
        if (paginaMatch) {
          pagina = paginaMatch[1];
        }
        
        // Determinar precisão
        let precisao: 'exata' | 'aproximada' | 'incompleta' = 'exata';
        if (valor.includes('-')) {
          precisao = 'exata'; // Range é considerado exato
        } else if (contexto.includes('cerca') || contexto.includes('aproximadamente')) {
          precisao = 'aproximada';
        } else if (contexto.length < 50) {
          precisao = 'incompleta';
        }
        
        // Extrair especificação específica
        let especificacao = padrao.categoria;
        if (padrao.categoria === 'Folga') {
          if (contexto.includes('acelerador') || contexto.includes('punho')) {
            especificacao = 'Folga do acelerador';
          } else if (contexto.includes('válvula')) {
            especificacao = 'Folga de válvulas';
          } else if (contexto.includes('travão') || contexto.includes('freio')) {
            especificacao = 'Folga do travão';
          }
        }
        
        especificacoes.push({
          modelo: modeloNome,
          categoria: padrao.categoria,
          especificacao,
          valor,
          unidade: padrao.unidade,
          pagina,
          contexto: contexto.length > 200 ? contexto.substring(0, 200) + '...' : contexto,
          precisao,
          fonte: arquivo
        });
      }
    }
  }
  
  // Remover duplicados e ordenar
  const uniqueEspecs = especificacoes.filter((item, index, self) => 
    index === self.findIndex((t) => 
      t.modelo === item.modelo && 
      t.especificacao === item.especificacao && 
      t.valor === item.valor
    )
  );
  
  return uniqueEspecs.sort((a, b) => {
    const order = `${a.modelo}_${a.categoria}_${a.especificacao}`.localeCompare(`${b.modelo}_${b.categoria}_${b.especificacao}`);
    return order;
  });
}

function gerarTabelaCompleta() {
  console.log('🔍 EXTRAINDO TODAS AS ESPECIFICAÇÕES TÉCNICAS');
  console.log('='.repeat(80));
  
  const especificacoes = extrairTodasEspecificacoes();
  
  // Agrupar por modelo
  const porModelo: Record<string, EspecificacaoTecnica[]> = {};
  especificacoes.forEach(esp => {
    if (!porModelo[esp.modelo]) {
      porModelo[esp.modelo] = [];
    }
    porModelo[esp.modelo].push(esp);
  });
  
  // Gerar tabela markdown
  let tabela = '# 📋 TABELA COMPLETA DE ESPECIFICAÇÕES TÉCNICAS\n\n';
  tabela += '## 📊 Resumo Geral\n\n';
  tabela += '| Modelo | Total Especificações | Folga | Dimensão | Capacidade | Peso | Velocidade | Elétrica |\n';
  tabela += '|--------|-------------------|-------|----------|-----------|-------|------------|----------|\n';
  
  for (const [modelo, especs] of Object.entries(porModelo)) {
    const categorias = {
      'Folga': especs.filter(e => e.categoria === 'Folga').length,
      'Dimensão': especs.filter(e => e.categoria === 'Dimensão').length,
      'Capacidade': especs.filter(e => e.categoria === 'Capacidade').length,
      'Peso': especs.filter(e => e.categoria === 'Peso').length,
      'Velocidade': especs.filter(e => e.categoria === 'Velocidade').length,
      'Elétrica': especs.filter(e => ['Voltagem', 'Corrente', 'Potência Elétrica'].includes(e.categoria)).length
    };
    
    tabela += `| ${modelo.toUpperCase()} | ${especs.length} | ${categorias.Folga} | ${categorias.Dimensão} | ${categorias.Capacidade} | ${categorias.Peso} | ${categorias.Velocidade} | ${categorias.Elétrica} |\n`;
  }
  
  tabela += '\n## 📋 Especificações Detalhadas\n\n';
  
  for (const [modelo, especs] of Object.entries(porModelo)) {
    tabela += `### 🏍️ ${modelo.toUpperCase()}\n\n`;
    tabela += '| Especificação | Valor | Unidade | Página | Precisão | Contexto |\n';
    tabela += '|--------------|-------|---------|--------|----------|----------|\n';
    
    especs.forEach(esp => {
      const contextoCurto = esp.contexto.length > 80 ? esp.contexto.substring(0, 80) + '...' : esp.contexto;
      tabela += `| ${esp.especificacao} | ${esp.valor} | ${esp.unidade} | ${esp.pagina} | ${esp.precisao} | ${contextoCurto} |\n`;
    });
    
    tabela += '\n';
  }
  
  // Estatísticas finais
  tabela += '## 📈 Estatísticas de Extração\n\n';
  tabela += '| Categoria | Total Ocorrências | Modelos Cobertos | Precisão Média |\n';
  tabela += '|-----------|------------------|------------------|----------------|\n';
  
  const categoriasCount: Record<string, number> = {};
  const categoriasModelos: Record<string, Set<string>> = {};
  
  especificacoes.forEach(esp => {
    categoriasCount[esp.categoria] = (categoriasCount[esp.categoria] || 0) + 1;
    if (!categoriasModelos[esp.categoria]) {
      categoriasModelos[esp.categoria] = new Set();
    }
    categoriasModelos[esp.categoria].add(esp.modelo);
  });
  
  for (const [categoria, count] of Object.entries(categoriasCount)) {
    const modelosCobertos = categoriasModelos[categoria]?.size || 0;
    tabela += `| ${categoria} | ${count} | ${modelosCobertos}/5 | Calculando |\n`;
  }
  
  // Salvar tabela
  fs.writeFileSync('./TABELA_ESPECIFICACOES_COMPLETA.md', tabela);
  console.log('✅ Tabela completa gerada: TABELA_ESPECIFICACOES_COMPLETA.md');
  
  // Salvar dados JSON
  fs.writeFileSync('./especificacoes-completas.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    total: especificacoes.length,
    porModelo,
    especificacoes
  }, null, 2));
  
  console.log(`📊 Total de especificações extraídas: ${especificacoes.length}`);
  console.log('📄 Dados detalhados salvos: especificacoes-completas.json');
  
  return especificacoes;
}

// Executar extração
if (import.meta.url === `file://${process.argv[1]}`) {
  gerarTabelaCompleta();
}

export { extrairTodasEspecificacoes, gerarTabelaCompleta };
