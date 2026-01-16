import { PdfProcessor } from './dist/src/pdf-processor.js';

// Vector store simples baseado em texto (sem embeddings)
class SimpleTextStore {
  documents = [];

  async insert(chunk: any): Promise<void> {
    this.documents.push({
      id: chunk.id,
      text: chunk.text,
      filename: chunk.filename,
      chunkIndex: chunk.chunkIndex
    });
  }

  async query(queryText: string, topK: number = 5): Promise<Array<{
    text: string;
    metadata: any;
    score: number;
  }>> {
    const results = this.documents
      .map(doc => {
        // Busca simples por palavras-chave
        const queryWords = queryText.toLowerCase().split(' ');
        const docWords = doc.text.toLowerCase();
        
        let score = 0;
        queryWords.forEach(word => {
          if (docWords.includes(word)) {
            score += 1;
          }
        });
        
        return {
          text: doc.text,
          metadata: {
            filename: doc.filename,
            chunkIndex: doc.chunkIndex
          },
          score: score / queryWords.length
        };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }
}

export class ManualRetrieverSimple {
  private pdfProcessor: PdfProcessor;
  private textStore: SimpleTextStore;
  private isIndexed: boolean = false;

  constructor() {
    this.pdfProcessor = new PdfProcessor();
    this.textStore = new SimpleTextStore();
  }

  async indexManuals() {
    if (this.isIndexed) {
      console.log('📚 Manuais já estão indexados');
      return;
    }

    console.log('🚀 Iniciando indexação dos manuais (modo texto)...');
    
    try {
      const documents = await this.pdfProcessor.processAllPdfs();
      const allChunks = [];
      
      for (const doc of documents) {
        const chunks = this.pdfProcessor.chunkDocument(doc, 1500, 300);
        for (const chunk of chunks) {
          allChunks.push({
            id: `${doc.filename}_${chunk.chunkIndex}`,
            text: chunk.text,
            filename: chunk.filename,
            chunkIndex: chunk.chunkIndex
          });
        }
      }

      console.log(`📝 Gerados ${allChunks.length} chunks para indexação`);

      for (const chunk of allChunks) {
        await this.textStore.insert(chunk);
      }

      this.isIndexed = true;
      console.log('✅ Indexação concluída com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro durante a indexação:', error);
      throw error;
    }
  }

  async retrieveRelevantDocuments(query: string, topK: number = 5) {
    if (!this.isIndexed) {
      await this.indexManuals();
    }

    try {
      const results = await this.textStore.query(query, topK);
      
      return results.map((result: any) => ({
        text: result.text,
        filename: result.metadata.filename,
        score: result.score
      }));

    } catch (error) {
      console.error('❌ Erro ao recuperar documentos:', error);
      return [];
    }
  }

  createRetrieverTool() {
    return {
      name: 'searchManuals',
      description: 'Procura informações técnicas nos manuais das motocicletas',
      inputSchema: {
        query: 'string',
        topK: 'number'
      },
      async execute({ query, topK = 3 }: { query: string; topK?: number }) {
        const results = await this.retrieveRelevantDocuments(query, topK);
        
        if (results.length === 0) {
          return 'Não foram encontradas informações relevantes nos manuais para esta consulta.';
        }

        const formattedResults = results.map((result, index) => 
          `**Resultado ${index + 1}** (Fonte: ${result.filename}, Score: ${result.score.toFixed(2)}):\n${result.text}`
        ).join('\n\n');

        return `Informações encontradas nos manuais:\n\n${formattedResults}`;
      }
    };
  }
}

// Teste
async function testSimpleRetriever() {
  console.log('🧪 Testando Manual Retriever Simples...');
  
  try {
    const retriever = new ManualRetrieverSimple();
    
    console.log('📚 Iniciando indexação...');
    await retriever.indexManuals();
    console.log('✅ Indexação concluída!');
    
    console.log('🔍 Testando busca...');
    const results = await retriever.retrieveRelevantDocuments('óleo motor', 3);
    
    console.log(`📊 Encontrados ${results.length} resultados:`);
    results.forEach((result, index) => {
      console.log(`\n--- Resultado ${index + 1} ---`);
      console.log(`Fonte: ${result.filename}`);
      console.log(`Score: ${result.score.toFixed(4)}`);
      console.log(`Texto: ${result.text.substring(0, 200)}...`);
    });
    
    console.log('\n🎉 Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testSimpleRetriever();
