import { MarkdownConverter } from './markdown-converter.js';
import { SelectiveIndexer } from './selective-indexer.js';

export class IndexManager {
  private converter: MarkdownConverter;
  private indexer: SelectiveIndexer;

  constructor(manualsPath: string = './manuals', indexPath: string = './data/index.json') {
    this.converter = new MarkdownConverter(manualsPath);
    this.indexer = new SelectiveIndexer(indexPath);
  }

  async buildFullIndex(): Promise<void> {
    console.log('🚀 Iniciando processo de indexação seletiva...\n');

    // 1. Converter PDFs para Markdown
    console.log('📄 Etapa 1: Convertendo PDFs para Markdown...');
    const documents = await this.converter.convertAllPdfs();
    console.log(`✅ ${documents.length} documentos convertidos\n`);

    // 2. Construir índice seletivo
    console.log('🔍 Etapa 2: Construindo índice seletivo...');
    const searchIndex = this.indexer.buildSearchIndex(documents);
    
    // 3. Salvar índice
    console.log('💾 Etapa 3: Salvando índice...');
    await this.indexer.saveIndex(searchIndex);
    
    console.log('\n🎉 Processo concluído com sucesso!');
    console.log(`📊 Estatísticas:`);
    console.log(`   - Modelos processados: ${documents.map(d => d.model).join(', ')}`);
    console.log(`   - Secções indexadas: ${searchIndex.documents.length}`);
    console.log(`   - Palavras-chave: ${searchIndex.keywordsIndex.size}`);
  }

  async searchModel(model: string, query?: string): Promise<any> {
    const index = await this.indexer.loadIndex();
    if (!index) {
      throw new Error('Índice não encontrado. Execute buildFullIndex() primeiro.');
    }

    if (query) {
      return this.indexer.search(query, index);
    } else {
      return this.indexer.getModelInfo(model, index);
    }
  }

  async getModelSpecifications(model: string): Promise<any> {
    const index = await this.indexer.loadIndex();
    if (!index) {
      throw new Error('Índice não encontrado. Execute buildFullIndex() primeiro.');
    }

    return this.indexer.getSpecifications(model, index);
  }

  async getIndexStats(): Promise<any> {
    const index = await this.indexer.loadIndex();
    if (!index) {
      return null;
    }

    const models = [...new Set(index.documents.map(d => d.metadata.brand + ' ' + d.model))];
    const highRelevance = index.documents.filter(d => d.relevance === 'high').length;
    const mediumRelevance = index.documents.filter(d => d.relevance === 'medium').length;

    return {
      totalDocuments: index.documents.length,
      totalKeywords: index.keywordsIndex.size,
      models,
      relevanceDistribution: {
        high: highRelevance,
        medium: mediumRelevance
      }
    };
  }
}
