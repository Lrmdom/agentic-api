import OpenAI from 'openai';
import fs from 'fs';

// Serviço Multi-lingual com OpenAI embeddings
class MultiLingualEmbeddingService {
  private openai: OpenAI;
  private model: string = 'text-embedding-3-large'; // 1536 dimensões
  private languages: Record<string, string> = {
    'pt': 'português',
    'en': 'english', 
    'es': 'español',
    'fr': 'français',
    'de': 'deutsch',
    'it': 'italiano',
    'ja': '日本語',
    'zh': '中文',
    'ko': '한국어'
  };

  constructor() {
    let apiKey = process.env.OPENAI_API_KEY;
    
    // Tentar ler do arquivo .env.local se não estiver em process.env
    if (!apiKey && fs.existsSync('.env.local')) {
      try {
        const envContent = fs.readFileSync('.env.local', 'utf8');
        const lines = envContent.split('\n');
        const openaiLine = lines.find(line => line.startsWith('OPENAI_API_KEY='));
        if (openaiLine) {
          apiKey = openaiLine.split('=')[1];
        }
      } catch (error) {
        console.error('Erro ao ler .env.local:', error);
      }
    }
    
    if (!apiKey) {
      throw new Error('❌ OPENAI_API_KEY não configurada!');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
    
    console.log('✅ OpenAI Embedding Service inicializado');
    console.log(`📦 Modelo: ${this.model} (${this.getEmbeddingDimensions()} dimensões)`);
    console.log(`🌐 Idiomas suportados: ${Object.keys(this.languages).length}`);
  }

  private getEmbeddingDimensions(): number {
    const dimensions: Record<string, number> = {
      'text-embedding-ada-002': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-3-small': 1536
    };
    return dimensions[this.model] || 1536;
  }

  // Criar embeddings multi-linguais
  async createMultiLingualEmbedding(text: string, languages: string[] = ['pt', 'en']): Promise<Record<string, number[]>> {
    console.log(`🧠 Gerando embeddings multi-linguais para: "${text.substring(0, 50)}..."`);
    
    const embeddings: Record<string, number[]> = {};
    
    for (const lang of languages) {
      try {
        // Traduzir texto para o idioma alvo
        const translatedText = await this.translateText(text, lang);
        
        // Gerar embedding do texto traduzido
        const embedding = await this.createEmbedding(translatedText);
        embeddings[lang] = embedding;
        
        console.log(`✅ ${lang}: "${translatedText.substring(0, 30)}..."`);
        
      } catch (error) {
        console.error(`❌ Erro no embedding ${lang}:`, error);
        // Fallback para embedding do texto original
        embeddings[lang] = await this.createEmbedding(text);
      }
    }
    
    console.log(`🎯 Embeddings geradas para ${languages.length} idiomas`);
    return embeddings;
  }

  // Tradução automática (pode usar Google Translate API)
  private async translateText(text: string, targetLang: string): Promise<string> {
    // Simulação - em produção usar Google Translate API
    const translations: Record<string, string> = {
      'pt': text, // Original
      'en': this.translateToEnglish(text),
      'es': this.translateToSpanish(text),
      'fr': this.translateToFrench(text),
      'de': this.translateToGerman(text),
      'it': this.translateToItalian(text)
    };
    
    return translations[targetLang] || text;
  }

  // Traduções simuladas básicas
  private translateToEnglish(text: string): string {
    const translations: Record<string, string> = {
      'Qual a pressão dos pneus': 'What is the tire pressure',
      'Qual a folga do acelerador': 'What is the throttle play',
      'Qual a capacidade do depósito': 'What is the fuel tank capacity',
      'Qual o torque do motor': 'What is the engine torque',
      'Honda PCX 125': 'Honda PCX 125',
      'Forza 125': 'Forza 125',
      'pressão': 'pressure',
      'folga': 'clearance',
      'capacidade': 'capacity',
      'torque': 'torque'
    };
    
    let translated = text;
    for (const [pt, en] of Object.entries(translations)) {
      translated = translated.replace(pt, en);
    }
    
    return translated;
  }

  private translateToSpanish(text: string): string {
    const translations: Record<string, string> = {
      'Qual a pressão dos pneus': '¿Cuál es la presión de los neumáticos',
      'Qual a folga do acelerador': '¿Cuál es la holgura del acelerador',
      'Qual a capacidade do depósito': '¿Cuál es la capacidad del depósito',
      'Qual o torque do motor': '¿Cuál es el par del motor',
      'pressão': 'presión',
      'folga': 'holgura',
      'capacidade': 'capacidad',
      'torque': 'par'
    };
    
    let translated = text;
    for (const [pt, es] of Object.entries(translations)) {
      translated = translated.replace(pt, es);
    }
    
    return translated;
  }

  private translateToFrench(text: string): string {
    const translations: Record<string, string> = {
      'Qual a pressão dos pneus': 'Quelle est la pression des pneus',
      'Qual a folga do acelerador': 'Quelle est le jeu de l accélérateur',
      'Qual a capacidade do depósito': 'Quelle est la capacité du réservoir',
      'Qual o torque do motor': 'Quel est le couple du moteur',
      'pressão': 'pression',
      'folga': 'jeu',
      'capacidade': 'capacité',
      'torque': 'couple'
    };
    
    let translated = text;
    for (const [pt, fr] of Object.entries(translations)) {
      translated = translated.replace(pt, fr);
    }
    
    return translated;
  }

  private translateToGerman(text: string): string {
    const translations: Record<string, string> = {
      'Qual a pressão dos pneus': 'Was ist der Reifendruck',
      'Qual a folga do acelerador': 'Was ist das Gasgriffspiel',
      'Qual a capacidade do depósito': 'Was ist der Tankkapazität',
      'Qual o torque do motor': 'Was ist das Motordrehmoment',
      'pressão': 'druck',
      'folga': 'spiel',
      'capacidade': 'kapazität',
      'torque': 'drehmoment'
    };
    
    let translated = text;
    for (const [pt, de] of Object.entries(translations)) {
      translated = translated.replace(pt, de);
    }
    
    return translated;
  }

  private translateToItalian(text: string): string {
    const translations: Record<string, string> = {
      'Qual a pressão dos pneus': 'Qual è la pressione degli pneumatici',
      'Qual a folga do acelerador': 'Qual è il gioco dell acceleratore',
      'Qual a capacidade do depósito': 'Qual è la capacità del serbatoio',
      'Qual o torque do motor': 'Qual è la coppia del motore',
      'pressão': 'pressione',
      'folga': 'gioco',
      'capacidade': 'capacità',
      'torque': 'coppia'
    };
    
    let translated = text;
    for (const [pt, it] of Object.entries(translations)) {
      translated = translated.replace(pt, it);
    }
    
    return translated;
  }

  // Gerar embedding com OpenAI
  private async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
      });
      
      return response.data[0].embedding;
      
    } catch (error) {
      console.error('❌ Erro ao gerar embedding OpenAI:', error);
      throw error;
    }
  }

  // Busca multi-lingual avançada
  async multiLingualSearch(query: string, languages: string[] = ['pt', 'en'], limit: number = 10): Promise<any[]> {
    console.log(`🌍 Multi-lingual Search: "${query}" em ${languages.join(', ')}`);
    
    // Gerar embeddings da query em múltiplos idiomas
    const queryEmbeddings = await this.createMultiLingualEmbedding(query, languages);
    
    // Buscar em todos os documentos
    const fs = await import('fs');
    const indiceNumerico = JSON.parse(fs.readFileSync('./indice-numerico.json', 'utf8'));
    
    const results = [];
    
    for (const document of indiceNumerico.dados) {
      let bestSimilarity = 0;
      let bestMatch = null;
      
      // Comparar com todos os idiomas
      for (const lang of languages) {
        const queryEmbedding = queryEmbeddings[lang];
        const docEmbedding = await this.createEmbedding(
          `${document.especificacao} ${document.valor} ${document.unidade} ${document.modelo}`
        );
        
        const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = {
            similarity,
            language: lang,
            languageName: this.languages[lang]
          };
        }
      }
      
      if (bestMatch && bestSimilarity > 0.7) { // Threshold alto
        results.push({
          ...document,
          similarity: bestSimilarity,
          matchedLanguage: bestMatch.languageName,
          confidence: Math.round(bestSimilarity * 100)
        });
      }
    }
    
    // Ordenar por similaridade
    const sortedResults = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    console.log(`✅ Encontrados ${sortedResults.length} resultados multi-linguais`);
    
    return sortedResults.map(doc => ({
      model: doc.modelo,
      section: doc.especificacao,
      type: 'specifications',
      content: `${doc.especificacao}: ${doc.valor} ${doc.unidade} (${doc.modelo}) - Match: ${doc.matchedLanguage} (${doc.confidence}%)`,
      similarity: doc.similarity,
      matchedLanguage: doc.matchedLanguage,
      confidence: doc.confidence
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

  // Métodos auxiliares
  getSupportedLanguages(): Record<string, string> {
    return this.languages;
  }

  getModelInfo(): any {
    return {
      model: this.model,
      dimensions: this.getEmbeddingDimensions(),
      supportedLanguages: Object.keys(this.languages),
      multilingual: true
    };
  }
}

export { MultiLingualEmbeddingService };
