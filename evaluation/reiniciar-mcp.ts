import { spawn } from 'child_process';
import path from 'path';

// Script para reiniciar completamente o sistema MCP
function reiniciarSistemaMCP() {
  console.log('🔄 REINICIANDO SISTEMA MCP COMPLETAMENTE...\n');
  
  return new Promise((resolve, reject) => {
    // Matar processos MCP existentes
    const killProcess = spawn('pkill', ['-f', 'mcp'], {
      stdio: 'inherit'
    });
    
    killProcess.on('close', (code) => {
      console.log(`✅ Processos MCP finalizados (código: ${code})`);
      
      // Esperar 2 segundos
      setTimeout(() => {
        console.log('🚀 Iniciando sistema MCP limpo...\n');
        
        // Iniciar novo processo MCP
        const mcpProcess = spawn('npx', ['tsx', 'src/mcp/manuals-server.ts'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: {
            ...process.env,
            // Limpar variáveis de cache
            NODE_OPTIONS: '--no-cache',
            MCP_CACHE_DISABLED: 'true'
          }
        });
        
        mcpProcess.stdout.on('data', (data) => {
          console.log(`MCP: ${data.toString()}`);
        });
        
        mcpProcess.stderr.on('data', (data) => {
          console.error(`MCP Error: ${data.toString()}`);
        });
        
        mcpProcess.on('close', (code) => {
          console.log(`MCP process exited with code: ${code}`);
        });
        
        // Esperar inicialização
        setTimeout(() => {
          console.log('✅ Sistema MCP reiniciado e pronto!\n');
          console.log('📋 AGORA TENTE SEUS PROMPTS NOVAMENTE:');
          console.log('   • Qual a pressão dos pneus da Honda Forza 350?');
          console.log('   • Qual a folga do acelerador da Honda Forza 125?');
          console.log('   • pressao');
          console.log('   • folga');
          resolve(mcpProcess);
        }, 3000);
      }, 2000);
    });
  });
}

// Executar reinicialização
if (import.meta.url === `file://${process.argv[1]}`) {
  reiniciarSistemaMCP().catch(console.error);
}

export { reiniciarSistemaMCP };
