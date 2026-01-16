import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

export interface SimpleDocument {
  filename: string;
  model: string;
  specifications: string;
  keyFeatures: string;
  metadata: {
    totalPages: number;
    year?: string;
    brand: string;
  };
}

export class SimpleExtractor {
  private manualsPath: string;

  constructor(manualsPath: string = './manuals') {
    this.manualsPath = path.resolve(manualsPath);
  }

  private extractModelFromFilename(filename: string): string {
    const models: Record<string, string> = {
      'PT_FORZA-350.pdf': 'Honda Forza 350',
      'PT_FORZA125_2021.pdf': 'Honda Forza 125',
      'PT_PCX125_2021.pdf': 'Honda PCX 125',
      'SH125_2022-1.pdf': 'Honda SH 125',
      'VISION_NSC110MPD-2017_PT.pdf': 'Honda Vision 110'
    };
    return models[filename] || filename.replace('.pdf', '').replace('PT_', '');
  }

  private extractYearFromFilename(filename: string): string | undefined {
    const yearMatch = filename.match(/(20\d{2})/);
    return yearMatch ? yearMatch[1] : undefined;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.,;:°%€$£¥\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async extractKeyPages(filename: string): Promise<SimpleDocument | null> {
    try {
      const filePath = path.join(this.manualsPath, filename);
      const fileBuffer = fs.readFileSync(filePath);
      const uint8Array = new Uint8Array(fileBuffer);
      
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      
      const numPages = pdf.numPages;
      console.log(`📖 A processar ${filename} (${numPages} páginas)...`);
      
      let specificationsText = '';
      let featuresText = '';
      
      // Procurar páginas importantes (geralmente no final do manual)
      const pagesToCheck = [
        Math.max(1, numPages - 20), // Últimas 20 páginas
        Math.max(1, Math.floor(numPages * 0.8)), // 80% do manual
        Math.max(1, Math.floor(numPages * 0.7)), // 70% do manual
      ];
      
      // Também verificar algumas páginas do meio
      for (let i = Math.floor(numPages * 0.3); i <= Math.floor(numPages * 0.5); i += 5) {
        pagesToCheck.push(i);
      }
      
      const uniquePages = [...new Set(pagesToCheck)].sort((a, b) => a - b);
      
      for (const pageNum of uniquePages) {
        if (pageNum > numPages) continue;
        
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const textItems = textContent.items as any[];
          let pageText = '';
          
          for (const item of textItems) {
            pageText += item.str + ' ';
          }
          
          pageText = this.cleanText(pageText);
          
          // Verificar se a página contém especificações
          const hasSpecs = pageText.match(/(especificaç|dimens|peso|motor|cilindrada|potência|binário|capacidade|consumo|velocidade|transmiss|suspens|trav|pneu|roda|medida)/i);
          const hasFeatures = pageText.match(/(equipamento|funcionalidade|tecnologia|sistema|display|painel|farol|led|abs|computador|bordo|keyless|modo|condução)/i);
          
          if (hasSpecs) {
            specificationsText += `\n--- Página ${pageNum} ---\n${pageText}\n`;
            console.log(`✅ Encontradas especificações na página ${pageNum}`);
          }
          
          if (hasFeatures) {
            featuresText += `\n--- Página ${pageNum} ---\n${pageText}\n`;
            console.log(`✅ Encontradas funcionalidades na página ${pageNum}`);
          }
          
        } catch (error) {
          console.log(`⚠️ Erro ao processar página ${pageNum}:`, error);
        }
      }

      // Se não encontrou conteúdo específico, extrair das últimas 5 páginas
      if (!specificationsText && !featuresText) {
        console.log(`🔍 Extrair conteúdo das últimas páginas...`);
        for (let pageNum = Math.max(1, numPages - 5); pageNum <= numPages; pageNum++) {
          try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            const textItems = textContent.items as any[];
            let pageText = '';
            
            for (const item of textItems) {
              pageText += item.str + ' ';
            }
            
            pageText = this.cleanText(pageText);
            specificationsText += `\n--- Página ${pageNum} ---\n${pageText}\n`;
            
          } catch (error) {
            console.log(`⚠️ Erro ao processar página ${pageNum}:`, error);
          }
        }
      }

      return {
        filename,
        model: this.extractModelFromFilename(filename),
        specifications: specificationsText.trim(),
        keyFeatures: featuresText.trim(),
        metadata: {
          totalPages: numPages,
          year: this.extractYearFromFilename(filename),
          brand: 'Honda'
        }
      };

    } catch (error) {
      console.error(`Erro ao extrair de ${filename}:`, error);
      return null;
    }
  }

  async extractAllDocuments(): Promise<SimpleDocument[]> {
    const files = fs.readdirSync(this.manualsPath)
      .filter(file => file.toLowerCase().endsWith('.pdf'));

    const documents: SimpleDocument[] = [];

    for (const filename of files) {
      const document = await this.extractKeyPages(filename);
      if (document && (document.specifications || document.keyFeatures)) {
        documents.push(document);
      }
    }

    return documents;
  }

  generateMarkdown(document: SimpleDocument): string {
    let markdown = `# ${document.model}\n\n`;
    
    markdown += `**Marca:** ${document.metadata.brand}\n`;
    if (document.metadata.year) {
      markdown += `**Ano:** ${document.metadata.year}\n`;
    }
    markdown += `**Total de páginas no manual:** ${document.metadata.totalPages}\n\n`;
    
    markdown += `---\n\n`;

    if (document.specifications) {
      markdown += `## 📋 Especificações Técnicas\n\n`;
      markdown += document.specifications + '\n\n';
    }

    if (document.keyFeatures) {
      markdown += `## 🚀 Funcionalidades e Equipamento\n\n`;
      markdown += document.keyFeatures + '\n\n';
    }

    return markdown;
  }

  async processAllPdfs(): Promise<SimpleDocument[]> {
    const documents = await this.extractAllDocuments();
    
    for (const document of documents) {
      const markdown = this.generateMarkdown(document);
      const outputPath = path.join(this.manualsPath, '..', 'markdown', `${document.model.replace(/\s+/g, '_')}.md`);
      
      const markdownDir = path.dirname(outputPath);
      if (!fs.existsSync(markdownDir)) {
        fs.mkdirSync(markdownDir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, markdown, 'utf8');
      console.log(`✅ Markdown gerado: ${outputPath}`);
    }

    return documents;
  }
}
