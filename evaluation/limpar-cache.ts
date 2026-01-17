import { execSync } from 'child_process';

console.log('🧹 LIMPANDO CACHE E REINICIANDO SISTEMA\n');

try {
  // Limpar cache do Node.js
  console.log('1. Limpando cache Node.js...');
  execSync('rm -rf node_modules/.cache', { stdio: 'inherit' });
  
  // Limpar arquivos temporários
  console.log('2. Limpando arquivos temporários...');
  execSync('rm -rf .temp *.tmp', { stdio: 'inherit' });
  
  // Matar processos MCP
  console.log('3. Finalizando processos MCP...');
  try {
    execSync('pkill -f "tsx.*manuals-server"', { stdio: 'inherit' });
  } catch (e) {
    console.log('   Nenhum processo MCP encontrado');
  }
  
  // Esperar um pouco
  console.log('4. Aguardando limpeza completa...');
  execSync('sleep 2', { stdio: 'inherit' });
  
  console.log('\n✅ SISTEMA LIMPO!\n');
  console.log('📋 INSTRUÇÕES PARA TESTAR SEM CACHE:\n');
  console.log('1. Use prompts DIFERENTES dos anteriores:');
  console.log('   • "Qual a pressão dos pneus em kPa?"');
  console.log('   • "Mostre os dados de pressão da Forza 350"');
  console.log('   • "Valores de pressão para Honda SH 125"');
  console.log('');
  console.log('2. Use termos simples:');
  console.log('   • "pressao kpa"');
  console.log('   • "folga acelerador"');
  console.log('   • "capacidade tanque"');
  console.log('');
  console.log('3. Varie a estrutura:');
  console.log('   • "Pressão: Honda Forza 350"');
  console.log('   • "Honda Forza 350 - pressão pneus"');
  console.log('   • "Dados técnicos: pressão"');
  console.log('');
  console.log('🚀 AGORA TESTE COM ESTES PROMPTS NOVOS!\n');
  
} catch (error) {
  console.error('❌ Erro na limpeza:', error);
}
