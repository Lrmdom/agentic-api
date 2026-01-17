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

  private async extractTextFromPage(page: any): Promise<string> {
    const textContent = await page.getTextContent();
    const textItems = textContent.items.map((item: any) => item.str);
    return textItems.join(' ').replace(/\s+/g, ' ').trim();
  }

  private async extractTablesFromPage(page: any): Promise<string[]> {
    try {
      const textContent = await page.getTextContent();
      const tables: string[] = [];
      let currentTable: string[] = [];
      let inTable = false;
      
      // Padrões que indicam o início de uma tabela de especificações
      const tableStartPatterns = [
        /especifica[çc][oõ]es? t[ée]cnicas?/i,
        /dados t[ée]cnicos/i,
        /torque|binário|aperto|folga|pressão|calibragem/i,
        /[0-9]\s*(?:Nm|kgf·m|bar|psi|mm|cm|°C|km\/h|l|kg)\b/i
      ];
      
      let lastY = -1;
      const rows: {y: number, text: string}[] = [];
      
      // Coletar linhas com suas posições Y
      for (const item of textContent.items as any[]) {
        const text = item.str.trim();
        if (text) {
          rows.push({
            y: Math.round(item.transform[5] * 10) / 10, // Posição Y arredondada
            text: text
          });
        }
      }
      
      // Agrupar linhas que estão na mesma posição Y
      const yGroups = new Map<number, string[]>();
      for (const row of rows) {
        if (!yGroups.has(row.y)) {
          yGroups.set(row.y, []);
        }
        yGroups.get(row.y)!.push(row.text);
      }
      
      // Verificar se há padrões de tabela
      let tableContent: string[] = [];
      let tableStarted = false;
      
      // Ordenar as linhas por posição Y (de cima para baixo)
      const sortedRows = Array.from(yGroups.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([y, texts]) => texts.join(' | '));
      
      // Procurar por tabelas no conteúdo
      for (let i = 0; i < sortedRows.length; i++) {
        const row = sortedRows[i];
        const nextRow = i < sortedRows.length - 1 ? sortedRows[i + 1] : '';
        
        // Verificar se a linha atual ou a próxima contêm padrões de tabela
        const isTableRow = tableStartPatterns.some(pattern => 
          pattern.test(row) || (nextRow && pattern.test(nextRow))
        );
        
        if (isTableRow || tableStarted) {
          tableContent.push(row);
          tableStarted = true;
          
          // Verificar se a tabela terminou (linha em branco ou mudança de contexto)
          if (!row.trim() || i === sortedRows.length - 1) {
            if (tableContent.length > 2) { // Pelo menos 2 linhas de conteúdo
              tables.push(tableContent.join('\n'));
            }
            tableContent = [];
            tableStarted = false;
          }
        }
      }
      
      return tables;
    } catch (error) {
      console.error('Erro ao extrair tabelas:', error);
      return [];
    }
  }

  async extractKeyPages(filename: string): Promise<SimpleDocument | null> {
    try {
      const filePath = path.join(this.manualsPath, filename);
      const fileBuffer = fs.readFileSync(filePath);
      const uint8Array = new Uint8Array(fileBuffer);
      
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      
      const numPages = pdf.numPages;
      console.log(`📖 Processando ${filename} (${numPages} páginas)...`);
      
      let specificationsText = '';
      let featuresText = '';
      let tablesFound = 0;
      
      // Estratégia de busca aprimorada:
      // 1. Verificar índice ou sumário (geralmente nas primeiras páginas)
      // 2. Verificar páginas finais (especificações técnicas)
      // 3. Verificar seções específicas baseadas no modelo
      
      // Páginas para verificar (priorizando início e fim do documento)
      const pagesToCheck = new Set<number>();
      
      // Primeiras páginas (índice/sumário)
      for (let i = 1; i <= Math.min(10, numPages); i++) {
        pagesToCheck.add(i);
      }
      
      // Últimas páginas (especificações técnicas)
      for (let i = Math.max(1, numPages - 30); i <= numPages; i++) {
        pagesToCheck.add(i);
      }
      
      // Amostrar páginas do meio (a cada 10% do documento)
      for (let i = 1; i <= 10; i++) {
        const pageNum = Math.floor((i / 10) * numPages);
        if (pageNum > 0 && pageNum <= numPages) {
          pagesToCheck.add(pageNum);
        }
      }
      
      const uniquePages = Array.from(pagesToCheck).sort((a, b) => a - b);
      
      // Procurar por tabelas de especificações
      console.log(`🔍 Procurando por tabelas de especificações...`);
      
      for (const pageNum of uniquePages) {
        if (pageNum > numPages) continue;
        
        try {
          const page = await pdf.getPage(pageNum);
          
          // Extrair texto da página para análise
          const pageText = await this.extractTextFromPage(page);
          
          // Verificar se a página contém termos relacionados a especificações
          const hasSpecs = /(especifica[çc][oõ]es? t[ée]cnicas?|dados t[ée]cnicos|torque|binário|folga|pressão|calibragem|aperto|parafuso|cabeçote|motor|cilindrada|potência|consumo|velocidade|transmissão|suspensão|travão|pneu|roda|medida|válvula|comando|junta|vedação)/i.test(pageText);
          
          // Verificar se a página contém termos relacionados a funcionalidades
          const hasFeatures = /(equipamento|funcionalidade|tecnologia|sistema|display|painel|farol|led|abs|computador|bordo|keyless|modo|condução|controle|assistente|segurança|conforto)/i.test(pageText);
          
          // Extrair tabelas se a página contiver especificações
          if (hasSpecs) {
            const tables = await this.extractTablesFromPage(page);
            
            if (tables.length > 0) {
              tablesFound += tables.length;
              specificationsText += `\n--- Tabela de Especificações (Página ${pageNum}) ---\n`;
              
              for (let i = 0; i < tables.length; i++) {
                specificationsText += `\nTabela ${i + 1}:\n${tables[i]}\n`;
              }
              
              console.log(`✅ Encontradas ${tables.length} tabela(s) de especificações na página ${pageNum}`);
            } else {
              // Se não encontrou tabelas, adiciona o texto bruto
              specificationsText += `\n--- Especificações (Página ${pageNum}) ---\n${pageText}\n`;
              console.log(`ℹ️  Texto de especificações encontrado na página ${pageNum} (sem tabelas identificadas)`);
            }
          }
          
          // Extrair funcionalidades (sem tabelas)
          if (hasFeatures) {
            featuresText += `\n--- Funcionalidades (Página ${pageNum}) ---\n${pageText}\n`;
            console.log(`✅ Texto de funcionalidades encontrado na página ${pageNum}`);
          }
          
        } catch (error) {
          console.error(`⚠️ Erro ao processar página ${pageNum}:`, error);
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
