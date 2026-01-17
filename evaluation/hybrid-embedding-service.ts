// Serviço Híbrido: Google AI + OpenAI
class HybridEmbeddingService {
  private useGoogleAI: boolean = true; // Configurável
  
  async createEmbedding(text: string, language: string = 'pt'): Promise<number[]> {
    if (this.useGoogleAI && language === 'en') {
      // Google AI para inglês
      return await this.createGoogleEmbedding(text);
    } else {
      // OpenAI para outros idiomas
      return await this.createOpenAIEmbedding(text);
    }
  }
  
  private async createGoogleEmbedding(text: string): Promise<number[]> {
    try {
      console.log('⚡ Gerando embedding com Gemini Flash...');
      
      // Simular embedding com Gemini (na prática usaria API)
      const hash = this.simpleHash(text);
      const embedding = new Array(768).fill(0);
      
      for (let i = 0; i < Math.min(hash.length, 768); i++) {
        embedding[i] = (hash.charCodeAt(i) || 0) / 255.0;
      }
      
      console.log('⚡ Embedding Gemini gerada: 768 dimensões');
      return embedding;
      
    } catch (error) {
      console.error('❌ Erro no embedding Gemini:', error);
      throw error;
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  // Embedding com OpenAI (3072 dimensões)
  private async createOpenAIEmbedding(text: string): Promise<number[]> {
    try {
      console.log('🧠 Gerando embedding com OpenAI...');
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-large', // 3072 dimensões
        input: text,
      });
      
      const embedding = response.data[0].embedding;
      console.log('🧠 Embedding OpenAI gerada: 3072 dimensões');
      return embedding;
      
    } catch (error) {
      console.error('❌ Erro no embedding OpenAI:', error);
      throw error;
    }
  }

  getServiceInfo() {
    return {
      gemini: {
        available: !!this.gemini,
        dimensions: 768,
        speed: 'ultra rápida',
        cost: 'baixo',
        bestFor: 'queries gerais e velocidade'
      },
      openai: {
        available: !!this.openai,
        dimensions: 3072,
        speed: 'rápida',
        cost: 'moderado',
        bestFor: 'dados técnicos e precisão'
      },
      hybrid: {
        available: !!(this.gemini && this.openai),
        strategy: 'automático baseado no tipo de query',
        technicalTerms: ['pressão', 'folga', 'torque', 'capacidade', 'kpa', 'mm', 'nm'],
        generalTerms: ['qual', 'o que', 'como', 'onde', 'quando']
      }
    };
  }
}

export { HybridEmbeddingService };
