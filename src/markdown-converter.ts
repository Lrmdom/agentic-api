import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

export interface MarkdownSection {
  title: string;
  content: string;
  page: number;
  relevance: 'high' | 'medium' | 'low';
}

export interface MarkdownDocument {
  filename: string;
  model: string;
  sections: MarkdownSection[];
  metadata: {
    totalPages: number;
    year?: string;
    brand: string;
  };
}

export class MarkdownConverter {
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

  private isRelevantSection(title: string, content: string): 'high' | 'medium' | 'low' {
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();

    // Alta relevância - especificações e funcionalidades
    const highRelevance = [
      'especificaç', 'dimens', 'peso', 'capacidade', 'motor', 'transmiss',
      'performance', 'consumo', 'velocidade', 'potência', 'binário',
      'equipamento', 'funcionalidade', 'tecnologia', 'sistema', 'display',
      'painel', 'instrumentos', 'farol', 'luz', 'travagem', 'abs',
      'combustível', 'depósito', 'autonomia', 'suspens', 'roda', 'pneu'
    ];

    // Média relevância - utilização e manutenção básica
    const mediumRelevance = [
      'guia de utilização', 'operaç', 'condução', 'manutenção',
      'revisão', 'óleo', 'filtro', 'ajuste', 'regulagem', 'verificação',
      'arranque', 'partida', 'aceleração', 'travagem', 'estacionamento'
    ];

    // Baixa relevância - informações gerais e legais
    const lowRelevance = [
      'segurança', 'garantia', 'legal', 'copyright', 'introdução',
      'bem-vindo', 'índice', 'conteúdo', 'avisos', 'precauç',
      'acessórios', 'modificações', 'carga', 'transporte'
    ];

    for (const keyword of highRelevance) {
      if (titleLower.includes(keyword) || contentLower.includes(keyword)) {
        return 'high';
      }
    }

    for (const keyword of mediumRelevance) {
      if (titleLower.includes(keyword) || contentLower.includes(keyword)) {
        return 'medium';
      }
    }

    for (const keyword of lowRelevance) {
      if (titleLower.includes(keyword)) {
        return 'low';
      }
    }

    return 'medium'; // Default para conteúdo não categorizado
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.,;:°%€$£¥]/g, '')
      .trim();
  }

  private extractSections(text: string): Array<{title: string, content: string, page: number}> {
    const sections = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let currentSection = { title: 'Informações Gerais', content: '', page: 1 };
    let currentPage = 1;
    let sectionStartPage = 1;
    let contentBuffer = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detetar mudança de página
      if (line.includes('--- Page') && line.includes('---')) {
        const pageMatch = line.match(/Page\s+(\d+)/);
        if (pageMatch) {
          currentPage = parseInt(pageMatch[1]);
        }
        continue;
      }

      // Ignorar linhas de metadados
      if (line.includes('.book Page') || 
          line.includes('JST') || 
          line.includes('Tuesday|Monday|Wednesday|Thursday|Friday|Saturday|Sunday') ||
          line.match(/\d{8}_\w+_\w+_BOOK/) ||
          line.match(/^[A-Z]+\d+.*\.book/)) {
        continue;
      }

      // Detetar títulos - critérios mais flexíveis
      const isTitle = (
        // Linhas curtas em maiúsculas
        (line.length > 3 && line.length < 80 && line === line.toUpperCase() && !line.match(/\d/)) ||
        // Títulos com números de página
        (line.includes('P. ') && line.length < 100) ||
        // Títulos com padrão de seção
        (line.includes('......') && line.length < 100) ||
        // Palavras-chave de seções importantes
        (line.match(/^(Especificaç|Dimens|Motor|Transmiss|Performance|Consumo|Capacidade|Peso|Medidas|Suspens|Trav|Farol|Painel|Instrumento|Manutenç|Revis|Óleo|Filtro|Vela|Bateria|Sistema|Chassi|Roda|Pneu|Segurança|Guia|Funcionamento|Localizaç|Componentes|Identificaç)/i)) ||
        // Títulos com dois pontos
        (line.includes(':') && line.length < 80 && line.length > 10)
      );

      if (isTitle && contentBuffer.length > 100) {
        // Guardar secção anterior se tiver conteúdo suficiente
        sections.push({
          title: this.cleanText(currentSection.title),
          content: this.cleanText(contentBuffer),
          page: sectionStartPage
        });
        
        currentSection = {
          title: line.replace(/[.\s]+$/, '').replace(/:+$/, '').replace(/P\.\s*\d+$/, '').trim(),
          content: '',
          page: currentPage
        };
        sectionStartPage = currentPage;
        contentBuffer = '';
      } else if (isTitle) {
        // Atualizar título da secção atual
        currentSection.title = line.replace(/[.\s]+$/, '').replace(/:+$/, '').replace(/P\.\s*\d+$/, '').trim();
        sectionStartPage = currentPage;
      } else if (line.length > 5 && !line.match(/^Page\s+\d+/)) {
        // Adicionar conteúdo se não for linha muito curta ou de página
        contentBuffer += line + ' ';
      }
    }

    // Adicionar última secção se tiver conteúdo
    if (contentBuffer.length > 100) {
      sections.push({
        title: this.cleanText(currentSection.title),
        content: this.cleanText(contentBuffer),
        page: sectionStartPage
      });
    }

    // Se não encontrou secções, criar uma única secção com todo o conteúdo
    if (sections.length === 0) {
      const cleanText = lines
        .filter(line => !line.includes('--- Page') && 
                       !line.includes('.book Page') && 
                       !line.includes('JST') &&
                       line.length > 5)
        .join(' ');
      
      if (cleanText.length > 100) {
        sections.push({
          title: 'Informações do Manual',
          content: this.cleanText(cleanText),
          page: 1
        });
      }
    }

    return sections;
  }

  async convertPdfToMarkdown(filename: string): Promise<MarkdownDocument | null> {
    try {
      const filePath = path.join(this.manualsPath, filename);
      const fileBuffer = fs.readFileSync(filePath);
      const uint8Array = new Uint8Array(fileBuffer);
      
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const numPages = pdf.numPages;
      
      console.log(`📖 A processar ${filename} (${numPages} páginas)...`);
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Agrupar texto por posição para evitar quebras de linha incorretas
        const textItems = textContent.items as any[];
        let lastY: number | null = null;
        let pageText = '';
        
        for (const item of textItems) {
          const currentY = Math.round(item.transform[5]);
          
          // Se mudou de linha, adicionar espaço
          if (lastY !== null && currentY !== lastY) {
            pageText += ' ';
          }
          
          pageText += item.str;
          lastY = currentY;
        }
        
        fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
      }

      // Debug: mostrar primeiras 2000 caracteres do texto extraído
      console.log(`📝 Texto extraído (primeiros 2000 caracteres):`);
      console.log(fullText.substring(0, 2000));
      console.log('\n---\n');

      const rawSections = this.extractSections(fullText);
      const sections: MarkdownSection[] = [];

      for (const rawSection of rawSections) {
        const relevance = this.isRelevantSection(rawSection.title, rawSection.content);
        
        if (relevance !== 'low') {
          sections.push({
            title: this.cleanText(rawSection.title),
            content: this.cleanText(rawSection.content),
            page: rawSection.page,
            relevance
          });
        }
      }

      return {
        filename,
        model: this.extractModelFromFilename(filename),
        sections,
        metadata: {
          totalPages: numPages,
          year: this.extractYearFromFilename(filename),
          brand: 'Honda'
        }
      };

    } catch (error) {
      console.error(`Erro ao converter PDF ${filename}:`, error);
      return null;
    }
  }

  generateMarkdown(document: MarkdownDocument): string {
    let markdown = `# ${document.model}\n\n`;
    
    markdown += `**Marca:** ${document.metadata.brand}\n`;
    if (document.metadata.year) {
      markdown += `**Ano:** ${document.metadata.year}\n`;
    }
    markdown += `**Total de páginas no manual:** ${document.metadata.totalPages}\n\n`;
    
    markdown += `---\n\n`;

    // Agrupar secções por relevância
    const highRelevance = document.sections.filter(s => s.relevance === 'high');
    const mediumRelevance = document.sections.filter(s => s.relevance === 'medium');

    if (highRelevance.length > 0) {
      markdown += `## 📋 Especificações e Funcionalidades\n\n`;
      for (const section of highRelevance) {
        markdown += `### ${section.title} (Página ${section.page})\n\n`;
        markdown += `${section.content}\n\n`;
      }
    }

    if (mediumRelevance.length > 0) {
      markdown += `## 📖 Guia de Utilização e Manutenção\n\n`;
      for (const section of mediumRelevance) {
        markdown += `### ${section.title} (Página ${section.page})\n\n`;
        markdown += `${section.content}\n\n`;
      }
    }

    return markdown;
  }

  async convertAllPdfs(): Promise<MarkdownDocument[]> {
    const files = fs.readdirSync(this.manualsPath)
      .filter(file => file.toLowerCase().endsWith('.pdf'));

    const documents: MarkdownDocument[] = [];

    for (const filename of files) {
      const document = await this.convertPdfToMarkdown(filename);
      if (document) {
        documents.push(document);
        
        // Gerar ficheiro markdown
        const markdown = this.generateMarkdown(document);
        const outputPath = path.join(this.manualsPath, '..', 'markdown', `${document.model.replace(/\s+/g, '_')}.md`);
        
        // Criar diretório se não existir
        const markdownDir = path.dirname(outputPath);
        if (!fs.existsSync(markdownDir)) {
          fs.mkdirSync(markdownDir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, markdown, 'utf8');
        console.log(`✅ Markdown gerado: ${outputPath}`);
      }
    }

    return documents;
  }
}
