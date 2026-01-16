import { Hono } from 'hono';
import { ManualRetrieverSimple } from './test-simple-retriever-new.js';

const app = new Hono();
const retriever = new ManualRetrieverSimple();

// Endpoint para testar busca nos manuais
app.post('/search-manuals', async (c) => {
  try {
    const body = await c.req.json();
    const { query, topK = 3 } = body;
    
    if (!query) {
      return c.json({ error: "Query é obrigatória" }, 400);
    }

    const results = await retriever.retrieveRelevantDocuments(query, topK);
    
    return c.json({
      success: true,
      query,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('Erro:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// Endpoint para indexar manuais
app.post('/index-manuals-simple', async (c) => {
  try {
    await retriever.indexManuals();
    return c.json({ 
      success: true, 
      message: "Manuais indexados com sucesso!" 
    });
  } catch (error) {
    console.error("Erro ao indexar manuais:", error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// Endpoint de health check
app.get('/', (c) => {
  return c.json({
    message: "Sistema de Manuais - API de Teste",
    endpoints: {
      "POST /search-manuals": "Buscar informações nos manuais",
      "POST /index-manuals-simple": "Indexar manuais (modo texto)"
    }
  });
});

const port = 3001;
console.log(`🚀 Servidor de teste rodando em http://localhost:${port}`);

export default {
  fetch: app.fetch,
  port
};
