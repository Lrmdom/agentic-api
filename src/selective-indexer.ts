import fs from 'fs';
import path from 'path';
import type { MarkdownDocument, MarkdownSection } from './markdown-converter.js';

export interface IndexedContent {
  id: string;
  model: string;
  section: string;
  content: string;
  relevance: 'high' | 'medium';
  page: number;
  keywords: string[];
  metadata: {
    brand: string;
    year?: string;
    filename: string;
  };
}

export interface SearchIndex {
  documents: IndexedContent[];
  keywordsIndex: Map<string, string[]>;
  modelsIndex: Map<string, string[]>;
}

export class SelectiveIndexer {
  private indexPath: string;

  constructor(indexPath: string = './data/index.json') {
    this.indexPath = path.resolve(indexPath);
  }

  private extractKeywords(text: string): string[] {
    const keywords = new Set<string>();
    
    // Palavras-chave relevantes para motos
    const relevantTerms = [
      'motor', 'cilindrada', 'potência', 'binário', 'velocidade', 'aceleração',
      'consumo', 'autonomia', 'depósito', 'capacidade', 'peso', 'dimensão',
      'comprimento', 'largura', 'altura', 'distância', 'entre-eixos', 'altura',
      'assento', 'suspensão', 'frente', 'traseira', 'travão', 'disco', 'abs',
      'pneu', 'roda', 'medida', 'pressão', 'transmissão', 'cvt', 'automática',
      'manual', 'marchas', 'embraiagem', 'arranque', 'elétrico', 'pedal',
      'farol', 'led', 'traseiro', 'dianteiro', 'pisca', 'luz', 'painel',
      'digital', 'analógico', 'display', 'computador', 'bordo', 'velocímetro',
      'conta-rotações', 'nível', 'combustível', 'temperatura', 'óleo', 'manutenção',
      'revisão', 'filtro', 'ar', 'óleo', 'vela', 'ignição', 'injeção', 'eletrónica',
      'bateria', 'voltagem', 'amperagem', 'carregamento', 'sistema', 'refrigeração',
      'líquido', 'arrefecimento', 'radiador', 'ventoinha', 'escape', 'catalisador',
      'silencioso', 'chassi', 'tipo', 'berço', 'duplo', 'simples', 'tubular',
      'material', 'aço', 'alumínio', 'forqueta', 'amortecedor', 'hidráulico',
      'regulável', 'freio', 'hidráulico', 'abs', 'dual', 'combined', 'estacionamento',
      'lateral', 'central', 'cavalete', 'suporte', 'bagagem', 'topo', 'malas',
      'porta', 'capacete', 'bloqueio', 'direção', 'imobilizador', 'alarme',
      'keyless', 'controlo', 'tração', 'estabilidade', 'modos', 'condução',
      'sport', 'eco', 'rain', 'urbano', 'estrada', 'acessórios', 'parabrisa',
      'protetor', 'mãos', 'assento', 'passageiro', 'cor', 'pintura', 'acabamento'
    ];

    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    for (const word of words) {
      if (relevantTerms.includes(word) || word.length > 4) {
        keywords.add(word);
      }
    }

    // Extrair números com unidades
    const numbersWithUnits = text.match(/\d+\s*(?:cc|cv|kw|nm|km\/h|l|kg|mm|cm|°|v|a)/gi);
    if (numbersWithUnits) {
      numbersWithUnits.forEach(unit => keywords.add(unit.toLowerCase()));
    }

    return Array.from(keywords);
  }

  private generateId(model: string, section: string): string {
    return `${model.replace(/\s+/g, '_').toLowerCase()}_${section.replace(/\s+/g, '_').toLowerCase()}`.substring(0, 50);
  }

  indexDocument(document: MarkdownDocument): IndexedContent[] {
    const indexedContent: IndexedContent[] = [];

    for (const section of document.sections) {
      if (section.relevance === 'low') continue;

      const keywords = this.extractKeywords(`${section.title} ${section.content}`);
      
      const indexed: IndexedContent = {
        id: this.generateId(document.model, section.title),
        model: document.model,
        section: section.title,
        content: section.content,
        relevance: section.relevance,
        page: section.page,
        keywords,
        metadata: {
          brand: document.metadata.brand,
          year: document.metadata.year,
          filename: document.filename
        }
      };

      indexedContent.push(indexed);
    }

    return indexedContent;
  }

  buildSearchIndex(documents: MarkdownDocument[]): SearchIndex {
    const allIndexedContent: IndexedContent[] = [];
    const keywordsIndex = new Map<string, string[]>();
    const modelsIndex = new Map<string, string[]>();

    // Indexar todos os documentos
    for (const document of documents) {
      const indexed = this.indexDocument(document);
      allIndexedContent.push(...indexed);

      // Construir índice de modelos
      if (!modelsIndex.has(document.model)) {
        modelsIndex.set(document.model, []);
      }
      modelsIndex.get(document.model)!.push(...indexed.map(item => item.id));
    }

    // Construir índice de palavras-chave
    for (const item of allIndexedContent) {
      for (const keyword of item.keywords) {
        if (!keywordsIndex.has(keyword)) {
          keywordsIndex.set(keyword, []);
        }
        keywordsIndex.get(keyword)!.push(item.id);
      }
    }

    return {
      documents: allIndexedContent,
      keywordsIndex,
      modelsIndex
    };
  }

  async saveIndex(index: SearchIndex): Promise<void> {
    const indexDir = path.dirname(this.indexPath);
    if (!fs.existsSync(indexDir)) {
      fs.mkdirSync(indexDir, { recursive: true });
    }

    const serializableIndex = {
      documents: index.documents,
      keywordsIndex: Object.fromEntries(index.keywordsIndex),
      modelsIndex: Object.fromEntries(index.modelsIndex)
    };

    fs.writeFileSync(this.indexPath, JSON.stringify(serializableIndex, null, 2), 'utf8');
    console.log(`✅ Índice salvo em: ${this.indexPath}`);
    console.log(`📊 ${index.documents.length} documentos indexados`);
    console.log(`🔑 ${index.keywordsIndex.size} palavras-chave indexadas`);
  }

  async loadIndex(): Promise<SearchIndex | null> {
    try {
      if (!fs.existsSync(this.indexPath)) {
        return null;
      }

      const data = fs.readFileSync(this.indexPath, 'utf8');
      const parsed = JSON.parse(data);

      return {
        documents: parsed.documents,
        keywordsIndex: new Map(Object.entries(parsed.keywordsIndex)),
        modelsIndex: new Map(Object.entries(parsed.modelsIndex))
      };
    } catch (error) {
      console.error('Erro ao carregar índice:', error);
      return null;
    }
  }

  search(query: string, index: SearchIndex): IndexedContent[] {
    const queryWords = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    const relevantIds = new Set<string>();

    for (const word of queryWords) {
      // Buscar exata
      if (index.keywordsIndex.has(word)) {
        index.keywordsIndex.get(word)!.forEach(id => relevantIds.add(id));
      }

      // Buscar parcial
      for (const [keyword, ids] of index.keywordsIndex.entries()) {
        if (keyword.includes(word) || word.includes(keyword)) {
          ids.forEach(id => relevantIds.add(id));
        }
      }
    }

    return index.documents
      .filter(item => relevantIds.has(item.id))
      .sort((a, b) => {
        // Priorizar alta relevância
        if (a.relevance !== b.relevance) {
          return a.relevance === 'high' ? -1 : 1;
        }
        
        // Priorizar correspondências no título
        const aTitleMatch = queryWords.some(word => a.section.toLowerCase().includes(word));
        const bTitleMatch = queryWords.some(word => b.section.toLowerCase().includes(word));
        
        if (aTitleMatch !== bTitleMatch) {
          return aTitleMatch ? -1 : 1;
        }

        return 0;
      });
  }

  getModelInfo(model: string, index: SearchIndex): IndexedContent[] {
    return index.documents
      .filter(item => item.model.toLowerCase().includes(model.toLowerCase()))
      .sort((a, b) => {
        if (a.relevance !== b.relevance) {
          return a.relevance === 'high' ? -1 : 1;
        }
        return a.section.localeCompare(b.section);
      });
  }

  getSpecifications(model: string, index: SearchIndex): IndexedContent[] {
    return index.documents
      .filter(item => 
        item.model.toLowerCase().includes(model.toLowerCase()) &&
        item.relevance === 'high' &&
        (item.section.toLowerCase().includes('especificaç') ||
         item.section.toLowerCase().includes('dimens') ||
         item.section.toLowerCase().includes('motor') ||
         item.section.toLowerCase().includes('performance'))
      )
      .sort((a, b) => a.section.localeCompare(b.section));
  }
}
