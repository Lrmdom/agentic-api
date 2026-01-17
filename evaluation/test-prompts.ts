import { mcpManager } from '../src/mcp/client.js';

// Lista de prompts de teste organizados por categoria
const TEST_PROMPTS = {
  folga: [
    'Qual a folga recomendada no acelerador da Honda Forza 125?',
    'Qual o valor da folga do punho do acelerador na SH 125?',
    'Qual a regulagem da folga do acelerador na PCX 125?',
    'Qual a folga na flange do punho do acelerador na Vision 110?',
    'Qual a folga do acelerador na CBR 650R?'
  ],
  binario: [
    'Qual o torque de aperto do parafuso do cabeçote no motor da Honda Forza 125?',
    'Qual o valor de torque recomendado para as porcas do motor da SH 125?',
    'Qual o binário de aperto da junta do cabeçote na PCX 125?',
    'Quais os valores de torque para montagem do motor da Vision 110?',
    'Qual o aperto recomendado para os parafusos do cilindro na CBR 650R?'
  ],
  pressao: [
    'Qual a pressão recomendada para os pneus da Honda Forza 125?',
    'Qual a calibragem dos pneus dianteiro e traseiro na SH 125?',
    'Qual a pressão de inflação dos pneus na PCX 125?',
    'Quais os valores de pressão para os pneus da Vision 110?',
    'Qual a pressão dos pneus na CBR 650R?'
  ],
  variacoes: [
    'Qual o jogo do acelerador da Forza 125?',
    'Qual a folga entre o punho e o cabo do acelerador na SH 125?',
    'Qual o aperto em Newton-metro do motor da PCX 125?',
    'Qual a calibragem em bar para os pneus da Forza 125?',
    'Compare a folga do acelerador entre a Forza 125 e a SH 125'
  ]
};

// Função para testar um prompt específico
async function testPrompt(prompt: string, category: string, index: number) {
  console.log(`\n🧪 TESTE ${category.toUpperCase()} #${index + 1}`);
  console.log(`❓ Prompt: "${prompt}"`);
  console.log('─'.repeat(80));
  
  try {
    // Tentar busca específica primeiro
    let response = await mcpManager.callTool('manuals', 'search_manuals', {
      query: prompt,
      type: 'all',
      limit: 10
    });
    
    let content = '';
    if (response && response.content && Array.isArray(response.content)) {
      content = response.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('\n');
    }
    
    // Se não encontrar dados específicos, tentar busca por palavras-chave
    if (!content || content.includes('Não foram encontradas informações relevantes')) {
      console.log('🔍 Tentando busca por palavras-chave...');
      
      const keywords = prompt.toLowerCase().split(' ').filter(word => word.length > 3);
      for (const keyword of keywords) {
        const keywordResponse = await mcpManager.callTool('manuals', 'search_manuals', {
          query: keyword,
          type: 'all',
          limit: 5
        });
        
        if (keywordResponse && keywordResponse.content && Array.isArray(keywordResponse.content)) {
          const keywordContent = keywordResponse.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('\n');
          
          if (keywordContent && !keywordContent.includes('Não foram encontradas')) {
            content += '\n' + keywordContent;
            break;
          }
        }
      }
    }
    
    console.log(`📄 Resposta (${content.length} caracteres):`);
    if (content.length > 500) {
      console.log(content.substring(0, 250) + '...');
      console.log('...');
      console.log(content.substring(content.length - 250));
    } else {
      console.log(content);
    }
    
    // Análise melhorada da resposta
    const numericalPatterns = [
      /\d+[\.,]?\d*\s*-\s*\d+[\.,]?\d*\s*mm/gi,  // 2 - 6 mm
      /\d+[\.,]?\d*\s*mm/gi,                      // 2 mm
      /\d+[\.,]?\d*\s*Nm/gi,                     // 12 Nm
      /\d+[\.,]?\d*\s*kgf·m/gi,                 // 1,2 kgf·m
      /\d+[\.,]?\d*\s*bar/gi,                    // 2,2 bar
      /\d+[\.,]?\d*\s*psi/gi                     // 32 psi
    ];
    
    const hasNumericalData = numericalPatterns.some(pattern => pattern.test(content));
    const hasFolga = /folga|jogo|regulagem|flange|acelerador|punho/i.test(content);
    const hasBinario = /torque|binário|aperto|parafuso|cabeçote|motor/i.test(content);
    const hasPressao = /pressão|calibragem|pneu|inflação/i.test(content);
    const hasSpecificValue = /2\s*-\s*6\s*mm|folga.*acelerador|flange.*punho/i.test(content);
    
    // Extrair valores numéricos encontrados
    const extractedValues: string[] = [];
    numericalPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        extractedValues.push(...matches);
      }
    });
    
    console.log(`\n📊 Análise:`);
    console.log(`  • Dados numéricos: ${hasNumericalData ? '✅' : '❌'}`);
    console.log(`  • Contexto folga: ${hasFolga ? '✅' : '❌'}`);
    console.log(`  • Contexto binário: ${hasBinario ? '✅' : '❌'}`);
    console.log(`  • Contexto pressão: ${hasPressao ? '✅' : '❌'}`);
    console.log(`  • Valor específico: ${hasSpecificValue ? '✅' : '❌'}`);
    
    if (extractedValues.length > 0) {
      console.log(`  • Valores extraídos: ${extractedValues.slice(0, 3).join(', ')}${extractedValues.length > 3 ? '...' : ''}`);
    }
    
    return {
      prompt,
      category,
      success: content.length > 0 && !content.includes('Não foram encontradas informações relevantes'),
      hasNumericalData,
      hasFolga,
      hasBinario,
      hasPressao,
      hasSpecificValue,
      extractedValues,
      contentLength: content.length
    };
    
  } catch (error) {
    console.error(`❌ Erro no teste: ${error}`);
    return {
      prompt,
      category,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Função principal de testes
async function runTests() {
  console.log('🚀 Iniciando testes de prompts para o sistema RAG/MCP');
  console.log('='.repeat(80));
  
  try {
    // Inicializa o servidor MCP
    console.log('🔄 Inicializando servidor de manuais...');
    await mcpManager.initializeServer('manuals', {
      command: 'npx',
      args: ['tsx', 'src/mcp/manuals-server.ts']
    });
    
    const results: any[] = [];
    
    // Testar cada categoria
    for (const [category, prompts] of Object.entries(TEST_PROMPTS)) {
      console.log(`\n\n🎯 TESTANDO CATEGORIA: ${category.toUpperCase()}`);
      console.log('='.repeat(80));
      
      for (let i = 0; i < prompts.length; i++) {
        const result = await testPrompt(prompts[i], category, i);
        results.push(result);
        
        // Pequena pausa entre testes
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Gerar relatório final
    console.log('\n\n📊 RELATÓRIO FINAL DOS TESTES');
    console.log('='.repeat(80));
    
    const categoryStats: Record<string, any> = {};
    
    for (const [category, prompts] of Object.entries(TEST_PROMPTS)) {
      const categoryResults = results.filter(r => r.category === category);
      const successCount = categoryResults.filter(r => r.success).length;
      const numericalDataCount = categoryResults.filter(r => r.hasNumericalData).length;
      
      categoryStats[category] = {
        total: prompts.length,
        success: successCount,
        successRate: Math.round((successCount / prompts.length) * 100),
        withNumericalData: numericalDataCount,
        numericalDataRate: Math.round((numericalDataCount / prompts.length) * 100)
      };
      
      console.log(`\n📌 ${category.toUpperCase()}:`);
      console.log(`  • Sucesso: ${successCount}/${prompts.length} (${categoryStats[category].successRate}%)`);
      console.log(`  • Com dados numéricos: ${numericalDataCount}/${prompts.length} (${categoryStats[category].numericalDataRate}%)`);
    }
    
    // Salvar resultados detalhados
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: categoryStats,
      detailedResults: results
    };
    
    const fs = await import('fs');
    fs.writeFileSync('./test-results.json', JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Resultados detalhados salvos em: ./test-results.json`);
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
  } finally {
    // Encerra o servidor MCP
    await mcpManager.cleanup();
    process.exit(0);
  }
}

// Executar testes
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests, TEST_PROMPTS };
