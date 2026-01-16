import { serve } from '@hono/node-server';
import app from './test-server.js';

const server = serve({
  fetch: app.fetch,
  port: app.port
});

console.log(`🚀 Servidor rodando em http://localhost:${app.port}`);
console.log('Endpoints disponíveis:');
console.log('  POST /search-manuals - Buscar nos manuais');
console.log('  POST /index-manuals-simple - Indexar manuais');
console.log('  GET / - Health check');

export default server;
