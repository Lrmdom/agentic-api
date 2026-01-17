import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

// Serviço de Embeddings usando Google Gemini text-embedding-004
class GeminiEmbeddingService {
  private genAI: GoogleGenerativeAI;
  private model: string = 'text-embedding-004'; // 768 dimensões

  constructor() {
    let apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    
    // Tentar ler do arquivo .env.local se não estiver em process.env
    if (!apiKey && fs.existsSync('.env.local')) {
      try {
        const envContent = fs.readFileSync('.env.local', 'utf8');
        const lines = envContent.split('\n');
        const geminiLine = lines.find(line => line.startsWith('GOOGLE_AI_STUDIO_API_KEY='));
        if (geminiLine) {
          apiKey = geminiLine.split('=')[1];
        }
      } catch (error) {
        console.error('Erro ao ler .env.local:', error);
      }
    }
    
    if (!apiKey) {
      throw new Error('❌ GOOGLE_AI_STUDIO_API_KEY não configurada!');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    console.log('✅ Gemini Embedding Service inicializado');
    console.log(`📦 Modelo: ${this.model} (768 dimensões)`);
    console.log(`🌐 Foco: Português + dados técnicos`);
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`🧠 Gerando embedding com Gemini: "${text.substring(0, 50)}..."`);
      
      // Usar a API de embeddings do Google com Genkit
      const { embed } = await import('@genkit-ai/googleai');
      const genkit = await import('@genkit-ai/core');
      
      const embedder = embed({ 
        apiKey: process.env.GOOGLE_AI_STUDIO_API_KEY,
        model: 'text-embedding-004' 
      });
      
      const result = await embedder.embed(text);
      
      if (result && result.embedding) {
        const embedding = result.embedding;
        console.log(`✅ Embedding Gemini gerada: ${embedding.length} dimensões`);
        return embedding;
      } else {
        throw new Error('Falha ao gerar embedding com Gemini');
      }
      
    } catch (error) {
      console.error('❌ Erro no embedding Gemini:', error);
      throw error;
    }
  }

  // Busca vetorial com Gemini
  async search(query: string, limit: number = 10): Promise<any[]> {
    console.log(`🔍 Gemini Search: "${query}"`);
    
    // Gerar embedding da query
    const queryEmbedding = await this.createEmbedding(query);
    
    // Carregar documentos
    const fs = await import('fs');
    const indiceNumerico = JSON.parse(fs.readFileSync('./indice-numerico.json', 'utf8'));
    
    // Buscar nos documentos
    const results = [];
    
    for (const document of indiceNumerico.dados) {
      // Gerar embedding do documento
      const docText = `${document.especificacao} ${document.valor} ${document.unidade} ${document.modelo}`;
      const docEmbedding = await this.createEmbedding(docText);
      
      // Calcular similaridade
      const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
      
      if (similarity > 0.7) { // Threshold para Gemini
        results.push({
          ...document,
          similarity,
          confidence: Math.round(similarity * 100),
          service: 'gemini'
        });
      }
    }
    
    // Ordenar por similaridade
    const sortedResults = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    console.log(`✅ Gemini Search: ${sortedResults.length} resultados encontrados`);
    
    return sortedResults.map(doc => ({
      model: doc.modelo,
      section: doc.especificacao,
      type: 'specifications',
      content: `${doc.especificacao}: ${doc.valor} ${doc.unidade} (${doc.modelo})`,
      similarity: doc.similarity,
      confidence: doc.confidence,
      service: 'gemini'
    }));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }

  // Métodos de informação
  getServiceInfo() {
    return {
      model: this.model,
      dimensions: 768,
      language: 'português',
      focus: 'dados técnicos',
      provider: 'Google Gemini',
      cost: 'baixo',
      speed: 'rápida'
    };
  }
}

export { GeminiEmbeddingService };
