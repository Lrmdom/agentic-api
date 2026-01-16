import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

export class PdfAnalyzer {
  private manualsPath: string;

  constructor(manualsPath: string = './manuals') {
    this.manualsPath = path.resolve(manualsPath);
  }

  async analyzePdfStructure(filename: string, maxPages: number = 5): Promise<any> {
    try {
      const filePath = path.join(this.manualsPath, filename);
      const fileBuffer = fs.readFileSync(filePath);
      const uint8Array = new Uint8Array(fileBuffer);
      
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      
      const analysis = {
        filename,
        totalPages: pdf.numPages,
        pages: [] as any[]
      };

      const pagesToAnalyze = Math.min(maxPages, pdf.numPages);
      
      for (let pageNum = 1; pageNum <= pagesToAnalyze; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');

        analysis.pages.push({
          pageNum,
          text: pageText.substring(0, 500) + (pageText.length > 500 ? '...' : ''),
          wordCount: pageText.split(/\s+/).length
        });
      }

      return analysis;
    } catch (error) {
      console.error(`Erro ao analisar PDF ${filename}:`, error);
      return null;
    }
  }

  async analyzeAllPdfs(): Promise<any[]> {
    const files = fs.readdirSync(this.manualsPath)
      .filter(file => file.toLowerCase().endsWith('.pdf'));

    const analyses = [];
    
    for (const filename of files) {
      console.log(`📊 A analisar estrutura de: ${filename}`);
      const analysis = await this.analyzePdfStructure(filename);
      if (analysis) {
        analyses.push(analysis);
      }
    }

    return analyses;
  }
}
