import { mcpManager } from '../src/mcp/client.js';
import { FinalIndexer } from '../src/final-indexer.js';

// Lista de modelos a serem avaliados
const MODELS = [
  'forza 125',
  'sh 125',
  'pcx 125',
  'vision 110',
  'cbr 650r'
];

// Tipos de dados numéricos a serem extraídos com múltiplas variações de consulta
const NUMERICAL_QUERIES = [
  { 
    type: 'binário', 
    queries: [
      'torque de aperto do parafuso do cabeçote',
      'valor de torque para o cabeçote',
      'binário de aperto da junta do cabeçote',
      'torque de montagem do motor',
      'valor de aperto das porcas do cabeçote'
    ]
  },
  { 
    type: 'folga', 
    queries: [
      'folga das válvulas de admissão e escape',
      'regulagem de válvulas',
      'jogo das válvulas',
      'folga entre válvula e balancim',
      'ajuste de tuchos e válvulas'
    ]
  },
  { 
    type: 'pressão', 
    queries: [
      'pressão de pneu recomendada',
      'calibragem dos pneus',
      'pressão do pneu dianteiro e traseiro',
      'pressão de ar dos pneus',
      'pressão de inflação dos pneus'
    ]
  }
];

// Função para extrair valores numéricos do texto com melhor precisão
function extractNumericalValues(text: string): {value: number, unit: string, context: string}[] {
  // Limpar o texto para melhor processamento
  const cleanText = text
    .replace(/[\u00A0\u2000-\u200F\u2028-\u202F\u205F\u3000]/g, ' ') // Substituir espaços especiais
    .replace(/[\u0080-\u00FF]/g, (match) => {
      // Mapear caracteres especiais comuns para versões limpas
      const specialChars: Record<string, string> = {
        'ã': 'a', 'õ': 'o', 'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a',
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
        'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o',
        'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
        'ç': 'c', 'ñ': 'n',
        '°': ' graus ', 'º': ' graus ', 'ª': ' a '
      };
      return specialChars[match] || ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();

  // Expressão regular aprimorada para capturar valores numéricos com unidades
  // Inclui padrões comuns de especificações técnicas
  const patterns = [
    // Padrão para torque (ex: 12 N·m, 1,2 kgf·m, 12Nm)
    /(?:torque|binário|aperto|parafuso|cabeçote|porca|motor)[\s\S]{0,50}?((?:\d+[\.,]?\d*|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?))\s*(N·m|Nm|kgf·m|kgfm|N\.m|Nm)/gi,
    
    // Padrão para pressão (ex: 2,2 bar, 32 psi)
    /(?:pressão|calibragem|pneu|pneu dianteiro|pneu traseiro|inflação)[\s\S]{0,50}?((?:\d+[\.,]?\d*|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?))\s*(bar|psi|kPa|kgf\/cm²)/gi,
    
    // Padrão para folga (ex: 0,15 mm, 0.15 mm, 2-6 mm)
    /(?:folga|jogo|válvula|admissão|escape|comando|balancim|flange|punho|acelerador)[\s\S]{0,50}?((?:\d+[\.,]?\d*|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?)(?:\s*-\s*(?:\d+[\.,]?\d*|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?))?\s*(mm|cm|in|polegadas?))/gi,
    
    // Padrão genérico para valores com unidades (mais flexível)
    /((?:\d+[\.,]?\d*|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?)(?:\s*-\s*(?:\d+[\.,]?\d*|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?))?\s*(mm|cm|m|km|g|kg|N|Nm|N·m|kgf·m|bar|psi|kPa|°C|°F|°|rpm|km\/h|hp|cv|cc|ml|l|A|V|W|Ah|Wh))/gi,
    
    // Padrão específico para valores seguidos por unidades sem espaço
    /(\d+[\.,]?\d*)(mm|cm|m|km|g|kg|N|Nm|N·m|kgf·m|bar|psi|kPa|°C|°F|rpm|km\/h|hp|cv|cc|ml|l|A|V|W|Ah|Wh)/gi
  ];
  
  const matches: {value: number, unit: string, context: string}[] = [];
  const seen = new Set<string>();
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(cleanText)) !== null) {
      // Encontrar o grupo de valor e unidade
      let valueStr = '';
      let unit = '';
      
      // Procurar grupos de captura de valor e unidade
      for (let i = 1; i < match.length; i++) {
        if (match[i] && /^\d+[\.,]?\d*$/.test(match[i].replace(/[\s-]/g, ''))) {
          valueStr = match[i];
        } else if (match[i] && /^(mm|cm|m|km|g|kg|N|Nm|N·m|kgf·m|bar|psi|kPa|°C|°F|rpm|km\/h|hp|cv|cc|ml|l|A|V|W|Ah|Wh)$/i.test(match[i])) {
          unit = match[i];
        }
      }
      
      if (!valueStr || !unit) continue;
      
      // Limpar e converter o valor
      valueStr = valueStr.replace(/[^\d.,]/g, '').replace(',', '.');
      const value = parseFloat(valueStr);
      
      // Criar uma chave única para evitar duplicatas
      const key = `${value}_${unit}`;
      
      if (!isNaN(value) && !seen.has(key)) {
        // Extrair contexto ao redor da correspondência (100 caracteres antes e depois)
        const start = Math.max(0, match.index - 100);
        const end = Math.min(cleanText.length, match.index + match[0].length + 100);
        const context = cleanText.substring(start, end).replace(/\s+/g, ' ').trim();
        
        matches.push({
          value,
          unit,
          context: context.length > 200 ? context.substring(0, 200) + '...' : context
        });
        
        seen.add(key);
      }
    }
  }
  
  return matches;
}

// Função para avaliar um modelo específico
async function evaluateModel(model: string) {
  console.log(`\n🔍 AVALIANDO MODELO: ${model.toUpperCase()}`);
  console.log('='.repeat(50));
  
  const results: any = {};
  
  for (const {type, queries} of NUMERICAL_QUERIES) {
    console.log(`\n📊 ${type.toUpperCase()}:`);
    results[type] = [];
    
    for (const query of queries) {
      try {
        console.log(`\n  ❓ Consulta: "${query}"`);
        
        // Chama a ferramenta de busca de manuais
        const response = await mcpManager.callTool('manuals', 'search_manuals', {
          query: `${model} ${query}`,
          model: model,
          type: 'specifications',
          limit: 20 // Aumentar o limite de resultados
        });
        
        let content = '';
        if (response && response.content && Array.isArray(response.content)) {
          content = response.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('\n');
        }
        
        // Se não encontrar nada com specifications, tentar com all
        if (!content || content.trim().length === 0) {
          console.log(`  🔍 Tentando busca amplificada...`);
          const fallbackResponse = await mcpManager.callTool('manuals', 'search_manuals', {
            query: `${model} ${query}`,
            model: model,
            type: 'all',
            limit: 20
          });
          
          if (fallbackResponse && fallbackResponse.content && Array.isArray(fallbackResponse.content)) {
            content = fallbackResponse.content
              .filter((item: any) => item.type === 'text')
              .map((item: any) => item.text)
              .join('\n');
          }
        }
        
        // Se ainda não encontrar, tentar busca genérica sem filtro de modelo
        if (!content || content.trim().length === 0) {
          console.log(`  🔍 Tentando busca genérica...`);
          const genericResponse = await mcpManager.callTool('manuals', 'search_manuals', {
            query: query,
            type: 'all',
            limit: 20
          });
          
          if (genericResponse && genericResponse.content && Array.isArray(genericResponse.content)) {
            content = genericResponse.content
              .filter((item: any) => item.type === 'text')
              .map((item: any) => item.text)
              .join('\n');
          }
        }
        
        console.log(`  📄 Conteúdo retornado: ${content.length} caracteres`);
        
        // Extrai valores numéricos com contexto aprimorado
        const numericalValues = extractNumericalValues(content);
        
        if (numericalValues.length > 0) {
          console.log(`  ✅ ${numericalValues.length} valor(es) encontrado(s):`);
          
          // Agrupar valores por unidade para melhor legibilidade
          const valuesByUnit: Record<string, {value: number, context: string}[]> = {};
          
          numericalValues.forEach(({value, unit, context}) => {
            if (!valuesByUnit[unit]) {
              valuesByUnit[unit] = [];
            }
            valuesByUnit[unit].push({value, context});
          });
          
          // Exibir valores agrupados por unidade
          for (const [unit, values] of Object.entries(valuesByUnit)) {
            const uniqueValues = Array.from(new Set(values.map(v => v.value)));
            console.log(`    • ${uniqueValues.join(' / ')} ${unit}`);
            
            // Mostrar contexto para o primeiro valor como exemplo
            if (values[0]?.context) {
              console.log(`      Contexto: "${values[0].context}"`);
            }
          }
          
          results[type].push({
            query,
            success: true,
            values: numericalValues,
            rawContent: content.length > 300 
              ? content.substring(0, 150) + '...' + content.substring(content.length - 150)
              : content
          });
        } else {
          console.log('  ❌ Nenhum valor numérico encontrado');
          
          // Tentar uma abordagem alternativa para encontrar valores numéricos
          const fallbackMatches = content.match(/(\d+[\.,]?\d*)(?:\s*-\s*(\d+[\.,]?\d*))?\s*(?:Nm|kgf·m|bar|psi|mm|cm|°C|km\/h|l|kg)/gi);
          
          if (fallbackMatches && fallbackMatches.length > 0) {
            console.log(`  ℹ️  Possíveis valores encontrados (sem contexto claro):`);
            console.log(`     ${fallbackMatches.slice(0, 10).join(', ')}${fallbackMatches.length > 10 ? '...' : ''}`);
          }
          
          // Mostrar trecho do conteúdo para debug
          if (content.length > 0) {
            console.log(`  📝 Trecho do conteúdo: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
          }
          
          results[type].push({
            query,
            success: false,
            error: 'Nenhum valor numérico encontrado',
            rawContent: content.length > 300 
              ? content.substring(0, 150) + '...' + content.substring(content.length - 150)
              : content
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ Erro ao processar consulta: ${errorMsg}`);
        results[type].push({
          query,
          success: false,
          error: errorMsg
        });
      }
    }
  }
  
  return results;
}

// Função principal
async function main() {
  console.log('🚀 Iniciando avaliação de modelos...');
  
  try {
    // Inicializa o servidor de manuais
    console.log('🔄 Inicializando servidor de manuais...');
    await mcpManager.initializeServer('manuals', {
      command: 'npx',
      args: ['tsx', 'src/mcp/manuals-server.ts']
    });
    
    const evaluationResults: Record<string, any> = {};
    
    // Avalia cada modelo
    for (const model of MODELS) {
      evaluationResults[model] = await evaluateModel(model);
    }
    
    // Gera relatório final
    console.log('\n📊 RELATÓRIO FINAL');
    console.log('='.repeat(40));
    
    for (const [model, results] of Object.entries(evaluationResults)) {
      console.log(`\n📌 ${model.toUpperCase()}`);
      
      for (const [type, queries] of Object.entries(results as object)) {
        const successful = (queries as any[]).filter(q => q.success).length;
        const total = (queries as any[]).length;
        console.log(`  ${type}: ${successful}/${total} sucessos (${Math.round((successful / total) * 100)}%)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro durante a avaliação:', error);
  } finally {
    // Encerra o servidor de manuais
    await mcpManager.cleanup();
    process.exit(0);
  }
}

// Executa a avaliação
main().catch(console.error);
