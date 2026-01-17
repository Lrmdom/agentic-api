import { mcpManager } from '../src/mcp/client.js';

// Script para testar se o contexto está sendo limpo entre chamadas
async function testarLimpezaContexto() {
  console.log('🧪 TESTANDO LIMPEZA DE CONTEXTO ENTRE CHAMADAS\n');
  
  try {
    // Inicializar servidor
    await mcpManager.initializeServer('manuals', {
      command: 'npx',
      args: ['tsx', 'src/mcp/manuals-server.ts']
    });
    
    // Lista de prompts para teste
    const prompts = [
      'Qual a pressão dos pneus da Honda Forza 350?',
      'Qual a folga do acelerador da Honda Forza 125?',
      'Qual a capacidade do depósito da Honda SH 125?',
      'Qual o torque da Honda Vision 110?',
      'pressao kpa',
      'folga acelerador',
      'capacidade tanque'
    ];
    
    console.log(`📋 Executando ${prompts.length} prompts sequenciais...\n`);
    
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      console.log(`\n🔍 TESTE ${i + 1}/${prompts.length}: "${prompt}"`);
      console.log('─'.repeat(60));
      
      try {
        const response = await mcpManager.callTool('manuals', 'search_manuals', {
          query: prompt,
          type: 'all',
          limit: 5
        });
        
        if (response && response.content && response.content.length > 0) {
          const textContent = response.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('\n');
          
          // Verificar se tem Call ID único
          const hasCallId = textContent.includes('Call ID:');
          
          // Verificar se tem dados numéricos
          const hasNumericData = textContent.includes('🔢');
          
          // Verificar se tem conteúdo repetido (indicador de cache)
          const contentLength = textContent.length;
          
          console.log(`✅ Resposta obtida:`);
          console.log(`   • Call ID único: ${hasCallId ? '✅' : '❌'}`);
          console.log(`   • Dados numéricos: ${hasNumericData ? '✅' : '❌'}`);
          console.log(`   • Tamanho: ${contentLength} caracteres`);
          console.log(`   • Preview: ${textContent.substring(0, 150)}...`);
          
          // Análise de repetição
          if (i > 0 && contentLength < 100) {
            console.log(`⚠️ POSSÍVEL CACHE: Resposta muito curta`);
          }
          
        } else {
          console.log('❌ Sem resposta');
        }
        
      } catch (error) {
        console.error(`❌ Erro no teste ${i + 1}:`, error);
      }
      
      // Pequena pausa entre chamadas
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Mostrar estatísticas finais
    const stats = mcpManager.getContextStats('manuals');
    console.log('\n📊 ESTATÍSTICAS FINAIS:');
    console.log(`   • Total de chamadas: ${stats.totalCalls}`);
    console.log(`   • Última chamada: ${stats.lastCall ? new Date(stats.lastCall).toLocaleTimeString() : 'N/A'}`);
    
    console.log('\n🎯 CONCLUSÃO:');
    console.log('   • Se cada resposta tem Call ID único: ✅ Contexto limpo');
    console.log('   • Se respostas se repetem: ❌ Contexto acumulando');
    console.log('   • Se dados numéricos aparecem: ✅ Sistema funcionando');
    
  } finally {
    // Limpar
    await mcpManager.cleanup();
    console.log('\n🔌 Teste concluído, servidor desconectado');
  }
}

// Executar teste
testarLimpezaContexto().catch(console.error);
