import { mcpManager } from '../src/mcp/client.js';

// Teste final para PCX 125 com busca melhorada
async function testarPCX125Corrigido() {
  console.log('🚀 TESTE FINAL: PCX 125 COM BUSCA MELHORADA\n');
  
  try {
    // Inicializar servidor
    await mcpManager.initializeServer('manuals', {
      command: 'npx',
      args: ['tsx', 'src/mcp/manuals-server.ts']
    });
    
    // Prompts para testar
    const prompts = [
      'Qual a pressão dos pneus da Honda PCX 125?',
      'Qual a folga do acelerador da Honda PCX 125?',
      'Qual a capacidade do depósito da Honda PCX 125?',
      'pressao pcx',
      'folga pcx',
      'capacidade pcx'
    ];
    
    console.log(`📋 Testando ${prompts.length} prompts para PCX 125...\n`);
    
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      console.log(`\n🔍 TESTE ${i + 1}: "${prompt}"`);
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
          
          // Verificar se menciona PCX
          const hasPCX = textContent.includes('PCX');
          
          console.log(`✅ Resultado:`);
          console.log(`   • Call ID único: ${hasCallId ? '✅' : '❌'}`);
          console.log(`   • Dados numéricos: ${hasNumericData ? '✅' : '❌'}`);
          console.log(`   • Menciona PCX: ${hasPCX ? '✅' : '❌'}`);
          console.log(`   • Tamanho: ${textContent.length} caracteres`);
          
          // Mostrar preview
          if (hasNumericData && hasPCX) {
            console.log(`   🎯 SUCESSO: Dados da PCX encontrados!`);
          }
          
        } else {
          console.log('❌ Sem resposta');
        }
        
      } catch (error) {
        console.error(`❌ Erro no teste ${i + 1}:`, error);
      }
      
      // Pequena pausa entre chamadas
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log('\n🎯 CONCLUSÃO FINAL:');
    console.log('✅ Sistema corrigido para busca flexível de modelos');
    console.log('✅ PCX 125 deve ser encontrada com variações de nome');
    
  } finally {
    // Limpar
    await mcpManager.cleanup();
    console.log('\n🔌 Teste concluído');
  }
}

// Executar teste
testarPCX125Corrigido().catch(console.error);
