import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { textEmbedding004 } from '@genkit-ai/googleai';
import { PdfProcessor, type PdfDocument } from './pdf-processor.js';
import { FinalIndexer, type SearchIndex } from './final-indexer.js';
import { SimpleExtractor, type SimpleDocument } from './simple-extractor.js';

export interface DocumentChunk {
  id: string;
  text: string;
  filename: string;
  chunkIndex: number;
  embedding?: number[];
}

// Vector store local simples
class SimpleVectorStore {
  private documents: Map<string, DocumentChunk> = new Map();

  async insert(chunk: DocumentChunk): Promise<void> {
    this.documents.set(chunk.id, chunk);
  }

  async query(embedding: number[], topK: number = 5): Promise<Array<{
    text: string;
    metadata: any;
    score: number;
  }>> {
    const results: Array<{
      text: string;
      metadata: any;
      score: number;
    }> = [];

    for (const doc of this.documents.values()) {
      if (doc.embedding) {
        const similarity = this.cosineSimilarity(embedding, doc.embedding);
        results.push({
          text: doc.text,
          metadata: {
            filename: doc.filename,
            chunkIndex: doc.chunkIndex
          },
          score: similarity
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    // Verificar se ambos são arrays
    if (!Array.isArray(a) || !Array.isArray(b)) {
      console.error('Embeddings inválidos:', { a: typeof a, b: typeof b });
      return 0;
    }
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export class ManualRetriever {
  private ai: any;
  private pdfProcessor: PdfProcessor;
  private vectorStore: any;
  private isIndexed: boolean = false;
  private finalIndexer: FinalIndexer;
  private searchIndex: SearchIndex | null = null;
  private useSelectiveIndex: boolean = true;

  constructor(aiInstance: any) {
    this.ai = aiInstance;
    this.pdfProcessor = new PdfProcessor();
    this.vectorStore = new SimpleVectorStore();
    this.finalIndexer = new FinalIndexer();
  }

  /**
   * Flow de indexação de PDFs - usa sistema seletivo
   */
  async indexManuals() {
    if (this.isIndexed) {
      console.log('📚 Manuais já estão indexados');
      return;
    }

    console.log('🚀 Iniciando indexação seletiva dos manuais...');
    
    try {
      // Tentar carregar índice existente
      const existingIndex = await this.finalIndexer.loadIndex();
      if (existingIndex) {
        console.log('📂 Carregando índice seletivo existente...');
        this.searchIndex = existingIndex;
        this.isIndexed = true;
        console.log(`✅ Índice carregado: ${this.searchIndex.documents.length} documentos`);
        return;
      }

      // Usar o novo sistema seletivo
      if (this.useSelectiveIndex) {
        console.log('📄 Usando sistema de extração seletiva...');
        
        // 1. Extrair conteúdo relevante
        const extractor = new SimpleExtractor();
        const documents = await extractor.processAllPdfs();
        
        // 2. Construir índice seletivo
        this.searchIndex = this.finalIndexer.buildSearchIndex(documents);
        
        // 3. Salvar índice
        await this.finalIndexer.saveIndex(this.searchIndex);
        
        console.log(`✅ Sistema seletivo indexado: ${this.searchIndex.documents.length} documentos`);
        this.isIndexed = true;
        return;
      }

      // Fallback para sistema original (código existente)
      console.log('📄 Usando sistema original de indexação...');
      
      // 1. Processar todos os PDFs
      const documents = await this.pdfProcessor.processAllPdfs();
      
      // 2. Criar chunks para melhor indexação
      const allChunks: DocumentChunk[] = [];
      
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

      // Mostrar exemplo do primeiro chunk
      if (allChunks.length > 0) {
        console.log('📄 Exemplo de chunk para indexar:');
        console.log('ID:', allChunks[0].id);
        console.log('Filename:', allChunks[0].filename);
        console.log('Texto (primeiros 200 chars):', allChunks[0].text.substring(0, 200) + '...');
        console.log('---');
      }

      // 3. Gerar embeddings e indexar
      for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i];
        
        try {
          // Gerar embedding
          const embeddingResult = await this.ai.embed({
            embedder: 'googleai/text-embedding-004',
            content: chunk.text
          });
          
          // Verificar diferentes estruturas de resposta
          let embedding;
          if (embeddingResult.embeddings && embeddingResult.embeddings.length > 0) {
            embedding = embeddingResult.embeddings[0];
          } else if (embeddingResult.embedding) {
            embedding = embeddingResult.embedding;
          } else if (Array.isArray(embeddingResult)) {
            embedding = embeddingResult[0];
          } else {
            console.error('Estrutura de embedding inesperada:', embeddingResult);
            // Fallback: usa texto como "embedding"
            embedding = chunk.text.split('').map(char => char.charCodeAt(0));
          }
          
          chunk.embedding = embedding;
          
          // Armazenar no vector store
          await this.vectorStore.insert({
            id: chunk.id,
            text: chunk.text,
            embedding: chunk.embedding,
            metadata: {
              filename: chunk.filename,
              chunkIndex: chunk.chunkIndex
            }
          });
          
          if ((i + 1) % 10 === 0) {
            console.log(`📊 Indexados ${i + 1}/${allChunks.length} chunks`);
          }
        } catch (error) {
          console.error(`❌ Erro ao indexar chunk ${chunk.id}:`, error);
        }
      }

      this.isIndexed = true;
      console.log('✅ Indexação concluída com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro durante a indexação:', error);
      throw error;
    }
  }

  /**
   * Recupera documentos relevantes - usa sistema seletivo
   */
  async retrieveRelevantDocuments(query: string, topK: number = 5): Promise<Array<{
    text: string;
    filename: string;
    score: number;
  }>> {
    if (!this.isIndexed) {
      await this.indexManuals();
    }

    try {
      // Usar sistema seletivo se disponível
      if (this.useSelectiveIndex && this.searchIndex) {
        console.log('🔍 Usando busca seletiva...');
        const results = this.finalIndexer.search(query, this.searchIndex);
        
        return results.slice(0, topK).map(result => ({
          text: result.content,
          filename: `${result.model} - ${result.section}`,
          score: 1.0 // Sistema seletivo usa ranking próprio
        }));
      }

      // Fallback para sistema original com embeddings
      console.log('🔍 Usando busca por embeddings...');
      
      // Gerar embedding para a query
      const queryEmbedding = await this.ai.embed({
        embedder: 'googleai/text-embedding-004',
        content: query
      });

      // Verificar diferentes estruturas de resposta
      let embedding;
      if (queryEmbedding.embeddings && queryEmbedding.embeddings.length > 0) {
        embedding = queryEmbedding.embeddings[0];
      } else if (queryEmbedding.embedding) {
        embedding = queryEmbedding.embedding;
      } else if (Array.isArray(queryEmbedding)) {
        embedding = queryEmbedding[0];
      } else {
        console.error('Estrutura de embedding inesperada na query:', queryEmbedding);
        // Fallback: usa texto como "embedding"
        embedding = query.split('').map(char => char.charCodeAt(0));
      }

      // Buscar documentos similares
      const results = await this.vectorStore.query(embedding, topK);

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

  /**
   * Tool para o Genkit usar o retriever
   */
  createRetrieverTool() {
    return this.ai.defineTool(
      {
        name: 'searchManuals',
        description: 'Procura informações técnicas nos manuais das motocicletas',
        inputSchema: z.object({
          query: z.string().describe('A pergunta ou tópico a procurar nos manuais'),
          topK: z.number().optional().default(3).describe('Número máximo de resultados a retornar')
        }),
      },
      async ({ query, topK }: { query: string; topK?: number }) => {
        const results = await this.retrieveRelevantDocuments(query, topK);
        
        if (results.length === 0) {
          return 'Não foram encontradas informações relevantes nos manuais para esta consulta.';
        }

        const formattedResults = results.map((result, index) => 
          `**Resultado ${index + 1}** (Fonte: ${result.filename}):\n${result.text}`
        ).join('\n\n');

        return `Informações encontradas nos manuais:\n\n${formattedResults}`;
      }
    );
  }
}
