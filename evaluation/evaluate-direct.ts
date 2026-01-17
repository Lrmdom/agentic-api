import fs from 'fs';
import path from 'path';

// Lista de modelos a serem avaliados
const MODELS = [
  'forza 125',
  'sh 125', 
  'pcx 125',
  'vision 110',
  'cbr 650r'
];

// Tipos de dados numéricos a serem extraídos
const NUMERICAL_QUERIES = [
  { 
    type: 'binário', 
    queries: [
      'torque de aperto',
      'valor de torque',
      'binário de aperto',
      'torque de montagem',
      'valor de aperto'
    ]
  },
  { 
    type: 'folga', 
    queries: [
      'folga das válvulas',
      'regulagem de válvulas',
      'jogo das válvulas',
      'folga entre válvula',
      'ajuste de tuchos'
    ]
  },
  { 
    type: 'pressão', 
    queries: [
      'pressão de pneu',
      'calibragem dos pneus',
      'pressão do pneu',
      'pressão de ar',
      'pressão de inflação'
    ]
  }
];

// Função para extrair valores numéricos do texto
function extractNumericalValues(text: string): {value: number, unit: string, context: string}[] {
  const patterns = [
    // Padrão para torque
    /(?:torque|binário|aperto|parafuso|cabeçote|porca|motor)[\s\S]{0,30}?((?:\d+[\.,]?\d*|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?))\s*(N·m|Nm|kgf·m|kgfm|N\.m|Nm)/gi,
    // Padrão para pressão
    /(?:pressão|calibragem|pneu|pneu dianteiro|pneu traseiro|inflação)[\s\S]{0,30}?((?:\d+[\.,]?\d*|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?))\s*(bar|psi|kPa|kgf\/cm²)/gi,
    // Padrão para folga (corrigido para capturar "2 - 6 mm")
    /(?:folga|jogo|válvula|admissão|escape|comando|balancim|flange|punho|acelerador)[\s\S]{0,30}?((?:\d+[\.,]?\d*|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?)(?:\s*-\s*(?:\d+[\.,]?\d*|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?))?\s*(mm|cm|in|polegadas?))/gi,
    // Padrão genérico (melhorado)
    /((?:\d+[\.,]?\d*|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?)(?:\s*-\s*(?:\d+[\.,]?\d*|\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d+)?))?\s*(mm|cm|m|km|g|kg|N|Nm|N·m|kgf·m|bar|psi|kPa|°C|°F|°|rpm|km\/h|hp|cv|cc|ml|l|A|V|W|Ah|Wh))/gi,
    // Padrão específico para "valor - valor mm"
    /(\d+)\s*-\s*(\d+)\s*(mm|cm|in|polegadas?)/gi
  ];
  
  const matches: {value: number, unit: string, context: string}[] = [];
  const seen = new Set<string>();
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let valueStr = '';
      let unit = '';
      let isRange = false;
      
      // Verificar se é um padrão de range (ex: "2 - 6 mm")
      if (match.length === 4 && /^\d+$/.test(match[1]) && /^\d+$/.test(match[2])) {
        // É um range, usar o primeiro valor
        valueStr = match[1];
        unit = match[3];
        isRange = true;
      } else {
        // Padrão normal
        for (let i = 1; i < match.length; i++) {
          if (match[i] && /^\d+[\.,]?\d*$/.test(match[i].replace(/[\s-]/g, ''))) {
            valueStr = match[i];
          } else if (match[i] && /^(mm|cm|m|km|g|kg|N|Nm|N·m|kgf·m|bar|psi|kPa|°C|°F|rpm|km\/h|hp|cv|cc|ml|l|A|V|W|Ah|Wh)$/i.test(match[i])) {
            unit = match[i];
          }
        }
      }
      
      if (!valueStr || !unit) continue;
      
      valueStr = valueStr.replace(/[^\d.,]/g, '').replace(',', '.');
      const value = parseFloat(valueStr);
      const key = `${value}_${unit}`;
      
      if (!isNaN(value) && !seen.has(key)) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(text.length, match.index + match[0].length + 50);
        let context = text.substring(start, end).replace(/\s+/g, ' ').trim();
        
        if (isRange) {
          context = context.replace(/(\d+)\s*-\s*(\d+)/, `$1-${match[2]}`);
        }
        
        matches.push({ value, unit, context });
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
  
  // Mapear modelo para arquivo markdown correspondente
  const modelToFileMap: Record<string, string> = {
    'forza 125': 'Honda_Forza_125.md',
    'sh 125': 'Honda_SH_125.md',
    'pcx 125': 'Honda_PCX_125.md',
    'vision 110': 'Honda_Vision_110.md',
    'cbr 650r': 'Honda_Forza_350.md' // Usando Forza 350 como proxy para CBR 650R
  };
  
  const filename = modelToFileMap[model.toLowerCase()];
  if (!filename) {
    console.log(`❌ Arquivo não encontrado para modelo: ${model}`);
    return results;
  }
  
  const filePath = path.join('./markdown', filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Arquivo não existe: ${filePath}`);
    return results;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`📄 Arquivo lido: ${filename} (${content.length} caracteres)`);
  
  for (const {type, queries} of NUMERICAL_QUERIES) {
    console.log(`\n📊 ${type.toUpperCase()}:`);
    results[type] = [];
    
    for (const query of queries) {
      console.log(`\n  ❓ Consulta: "${query}"`);
      
      // Extrai valores numéricos
      const numericalValues = extractNumericalValues(content);
      
      // Filtrar valores relevantes para a consulta
      const relevantValues = numericalValues.filter(item => {
        const context = item.context.toLowerCase();
        const queryLower = query.toLowerCase();
        
        if (type === 'binário') {
          return context.includes('torque') || context.includes('aperto') || context.includes('binário') || 
                 context.includes('parafuso') || context.includes('cabeçote') || context.includes('motor');
        } else if (type === 'folga') {
          return context.includes('folga') || context.includes('jogo') || context.includes('válvula') || 
                 context.includes('admissão') || context.includes('escape') || context.includes('flange') ||
                 context.includes('punho') || context.includes('acelerador');
        } else if (type === 'pressão') {
          return context.includes('pressão') || context.includes('calibragem') || context.includes('pneu') ||
                 context.includes('inflação');
        }
        
        return false;
      });
      
      if (relevantValues.length > 0) {
        console.log(`  ✅ ${relevantValues.length} valor(es) encontrado(s):`);
        
        const valuesByUnit: Record<string, {value: number, context: string}[]> = {};
        relevantValues.forEach(({value, unit, context}) => {
          if (!valuesByUnit[unit]) {
            valuesByUnit[unit] = [];
          }
          valuesByUnit[unit].push({value, context});
        });
        
        for (const [unit, values] of Object.entries(valuesByUnit)) {
          const uniqueValues = Array.from(new Set(values.map(v => v.value)));
          console.log(`    • ${uniqueValues.join(' / ')} ${unit}`);
          
          if (values[0]?.context) {
            console.log(`      Contexto: "${values[0].context}"`);
          }
        }
        
        results[type].push({
          query,
          success: true,
          values: relevantValues,
          totalFound: numericalValues.length
        });
      } else {
        console.log('  ❌ Nenhum valor relevante encontrado');
        
        if (numericalValues.length > 0) {
          console.log(`  ℹ️  Outros valores encontrados: ${numericalValues.slice(0, 3).map(v => `${v.value} ${v.unit}`).join(', ')}`);
        }
        
        results[type].push({
          query,
          success: false,
          error: 'Nenhum valor relevante encontrado',
          totalFound: numericalValues.length
        });
      }
    }
  }
  
  return results;
}

// Função principal
async function main() {
  console.log('🚀 Iniciando avaliação direta dos manuais...');
  
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
  
  // Salvar resultados detalhados
  const reportPath = './evaluation-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(evaluationResults, null, 2));
  console.log(`\n📄 Relatório detalhado salvo em: ${reportPath}`);
}

// Executa a avaliação
main().catch(console.error);
