import fs from 'fs';

interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    modelo: string;
    especificacao: string;
    valor: number;
    unidade: string;
    pagina: string;
    tipo: string;
    contexto: string;
  };
  similarity?: number; // Adicionado para busca
}

class VectorSearchService {
  private documents: VectorDocument[] = [];
  private embeddingDimension: number = 384; // OpenAI ada-002

  constructor() {
    this.loadDocuments();
  }

  private async loadDocuments() {
    console.log('📂 Carregando documentos para Vector Search...');
    
    try {
      // Carregar dados numéricos existentes
      const indiceNumerico = JSON.parse(fs.readFileSync('./indice-numerico.json', 'utf8'));
      
      this.documents = indiceNumerico.dados.map((dado: any, index: number) => ({
        id: `doc-${index}`,
        content: `${dado.especificacao} ${dado.valor} ${dado.unidade} ${dado.modelo} ${dado.contexto}`,
        embedding: [], // Será gerado depois
        metadata: {
          modelo: dado.modelo,
          especificacao: dado.especificacao,
          valor: dado.valor,
          unidade: dado.unidade,
          pagina: dado.pagina,
          tipo: dado.tipo,
          contexto: dado.contexto
        }
      }));

      console.log(`✅ ${this.documents.length} documentos carregados`);
      
      // Gerar embeddings (em produção seria feito uma vez)
      await this.generateEmbeddings();
      
    } catch (error) {
      console.error('❌ Erro ao carregar documentos:', error);
    }
  }

  private async generateEmbeddings() {
    console.log('🧠 Gerando embeddings para Vector Search...');
    
    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      
      try {
        // Simular embedding (em produção usar API real)
        doc.embedding = await this.createMockEmbedding(doc.content);
        
        if ((i + 1) % 10 === 0) {
          console.log(`  Processados ${i + 1}/${this.documents.length} embeddings`);
        }
      } catch (error) {
        console.error(`❌ Erro no embedding do documento ${i}:`, error);
        doc.embedding = new Array(this.embeddingDimension).fill(0);
      }
    }
    
    console.log('✅ Embeddings geradas com sucesso');
  }

  private async createMockEmbedding(text: string): Promise<number[]> {
    // Simular embedding baseada em hash do texto
    // Em produção: return await createEmbedding(text);
    const hash = this.simpleHash(text);
    const embedding = new Array(this.embeddingDimension).fill(0);
    
    // Preencher com valores baseados no hash
    for (let i = 0; i < Math.min(hash.length, this.embeddingDimension); i++) {
      embedding[i] = (hash.charCodeAt(i) || 0) / 255.0;
    }
    
    return embedding;
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

  // Busca por similaridade de cosseno
  async search(query: string, limit: number = 10): Promise<VectorDocument[]> {
    console.log(`🔍 Vector Search: "${query}"`);
    
    // Gerar embedding da query
    const queryEmbedding = await this.createMockEmbedding(query);
    
    // Calcular similaridade com todos os documentos
    const results = this.documents.map(doc => {
      const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
      return {
        ...doc,
        similarity
      };
    });
    
    // Ordenar por similaridade (maior primeiro)
    const sortedResults = results
      .filter(doc => doc.similarity > 0.3) // Threshold mínimo
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    console.log(`✅ Encontrados ${sortedResults.length} resultados relevantes`);
    
    return sortedResults;
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

  // Busca híbrida: Vector + Textual
  async hybridSearch(query: string, model?: string, limit: number = 10): Promise<any[]> {
    console.log(`🚀 Hybrid Search: "${query}" ${model ? `(modelo: ${model})` : ''}`);
    
    // 1. Vector Search principal
    const vectorResults = await this.search(query, limit * 2);
    
    // 2. Filtrar por modelo se especificado
    let filteredResults = vectorResults;
    if (model) {
      const modelLower = model.toLowerCase();
      filteredResults = vectorResults.filter(doc => 
        doc.metadata.modelo.toLowerCase().includes(modelLower) ||
        modelLower.includes(doc.metadata.modelo.toLowerCase())
      );
    }
    
    // 3. Converter para formato de resposta
    const formattedResults = filteredResults.map(doc => ({
      model: doc.metadata.modelo,
      section: doc.metadata.especificacao,
      type: 'specifications',
      content: `${doc.metadata.especificacao}: ${doc.metadata.valor} ${doc.metadata.unidade} (Página ${doc.metadata.pagina})\nContexto: ${doc.metadata.contexto.substring(0, 200)}...`,
      similarity: doc.similarity,
      callId: `vector-${Date.now()}`,
      timestamp: Date.now()
    }));
    
    return formattedResults;
  }

  // Salvar índice vectorial
  async saveVectorIndex() {
    const vectorIndex = {
      timestamp: new Date().toISOString(),
      documents: this.documents,
      embeddingDimension: this.embeddingDimension,
      totalDocuments: this.documents.length
    };
    
    fs.writeFileSync('./vector-index.json', JSON.stringify(vectorIndex, null, 2));
    console.log('✅ Índice vectorial salvo: ./vector-index.json');
  }

  // Estatísticas da busca
  getSearchStats() {
    return {
      totalDocuments: this.documents.length,
      embeddingDimension: this.embeddingDimension,
      indexSize: JSON.stringify(this.documents).length,
      averageDocumentLength: this.documents.reduce((sum, doc) => sum + doc.content.length, 0) / this.documents.length
    };
  }
}

// Exportar serviço
export { VectorSearchService };
export type { VectorDocument };
