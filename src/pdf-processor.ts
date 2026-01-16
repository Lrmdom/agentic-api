import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configurar o worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

export interface PdfDocument {
  filename: string;
  content: string;
  metadata: {
    pages: number;
    title?: string;
    author?: string;
    subject?: string;
  };
}

export class PdfProcessor {
  private manualsPath: string;

  constructor(manualsPath: string = './manuals') {
    this.manualsPath = path.resolve(manualsPath);
  }

  /**
   * Lista todos os ficheiros PDF na pasta de manuais
   */
  async listPdfFiles(): Promise<string[]> {
    try {
      const files = fs.readdirSync(this.manualsPath);
      return files.filter(file => file.toLowerCase().endsWith('.pdf'));
    } catch (error) {
      console.error('Erro ao listar ficheiros PDF:', error);
      return [];
    }
  }

  /**
   * Processa um único ficheiro PDF
   */
  async processPdfFile(filename: string): Promise<PdfDocument | null> {
    try {
      const filePath = path.join(this.manualsPath, filename);
      const fileBuffer = fs.readFileSync(filePath);
      
      // Converter Buffer para Uint8Array
      const uint8Array = new Uint8Array(fileBuffer);
      
      // Carregar o PDF
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      
      // Extrair texto de todas as páginas
      let fullText = '';
      const numPages = pdf.numPages;
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      // Obter metadados
      const metadata = await pdf.getMetadata();
      const info = metadata.info as any;
      
      return {
        filename,
        content: fullText.trim(),
        metadata: {
          pages: numPages,
          title: info?.Title,
          author: info?.Author,
          subject: info?.Subject,
        }
      };
    } catch (error) {
      console.error(`Erro ao processar PDF ${filename}:`, error);
      return null;
    }
  }

  /**
   * Processa todos os PDFs na pasta de manuais
   */
  async processAllPdfs(): Promise<PdfDocument[]> {
    const pdfFiles = await this.listPdfFiles();
    const documents: PdfDocument[] = [];

    console.log(`📄 A processar ${pdfFiles.length} ficheiros PDF...`);

    for (const filename of pdfFiles) {
      console.log(`📖 A processar: ${filename}`);
      const document = await this.processPdfFile(filename);
      if (document) {
        documents.push(document);
        console.log(`✅ Concluído: ${filename} (${document.metadata.pages} páginas)`);
      }
    }

    console.log(`📚 Processamento concluído: ${documents.length} documentos processados`);
    return documents;
  }

  /**
   * Divide o conteúdo do PDF em chunks para melhor indexação
   */
  chunkDocument(document: PdfDocument, chunkSize: number = 1000, overlap: number = 200): Array<{
    text: string;
    filename: string;
    chunkIndex: number;
  }> {
    const chunks = [];
    const { content, filename } = document;
    
    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const chunk = content.slice(i, i + chunkSize);
      if (chunk.trim()) {
        chunks.push({
          text: chunk.trim(),
          filename,
          chunkIndex: Math.floor(i / (chunkSize - overlap))
        });
      }
    }
    
    return chunks;
  }
}
