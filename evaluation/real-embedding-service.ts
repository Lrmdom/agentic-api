import OpenAI from 'openai';

// Serviço REAL de embeddings OpenAI
class RealEmbeddingService {
  private openai: OpenAI;
  private model: string = 'text-embedding-ada-002';

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('❌ OPENAI_API_KEY não configurada!');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    console.log('✅ OpenAI Embedding Service inicializado');
    console.log(`📦 Modelo: ${this.model}`);
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`🧠 Gerando embedding para: "${text.substring(0, 50)}..."`);
      
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
      });
      
      const embedding = response.data[0].embedding;
      console.log(`✅ Embedding gerada: ${embedding.length} dimensões`);
      
      return embedding;
      
    } catch (error) {
      console.error('❌ Erro ao gerar embedding:', error);
      throw error;
    }
  }

  async createMultipleEmbeddings(texts: string[]): Promise<number[][]> {
    console.log(`🧠 Gerando ${texts.length} embeddings...`);
    
    const embeddings = [];
    
    for (let i = 0; i < texts.length; i++) {
      const embedding = await this.createEmbedding(texts[i]);
      embeddings.push(embedding);
      
      if ((i + 1) % 5 === 0) {
        console.log(`  Processados ${i + 1}/${texts.length} embeddings`);
      }
    }
    
    console.log('✅ Todas as embeddings geradas com sucesso');
    return embeddings;
  }

  getModelInfo() {
    return {
      model: this.model,
      dimensions: 1536, // ada-002
      maxTokens: 8191
    };
  }
}

export { RealEmbeddingService };
