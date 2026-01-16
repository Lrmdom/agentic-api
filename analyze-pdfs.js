import { PdfAnalyzer } from './src/pdf-analyzer.js';

async function main() {
  const analyzer = new PdfAnalyzer();
  const analyses = await analyzer.analyzeAllPdfs();
  
  console.log('\n📋 ANÁLISE ESTRUTURAL DOS PDFS:\n');
  
  analyses.forEach(analysis => {
    console.log(`📄 ${analysis.filename}`);
    console.log(`   Total de páginas: ${analysis.totalPages}`);
    console.log('   Primeiras páginas:');
    
    analysis.pages.forEach(page => {
      console.log(`     Página ${page.pageNum} (${page.wordCount} palavras):`);
      console.log(`     "${page.text}"`);
      console.log('');
    });
    
    console.log('---\n');
  });
}

main().catch(console.error);
