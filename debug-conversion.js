import { MarkdownConverter } from './src/markdown-converter.js';

async function debugConversion() {
  const converter = new MarkdownConverter();
  
  // Testar com um ficheiro apenas
  const document = await converter.convertPdfToMarkdown('PT_FORZA125_2021.pdf');
  
  if (document) {
    console.log(`📄 Modelo: ${document.model}`);
    console.log(`📊 Total de secções extraídas: ${document.sections.length}`);
    
    console.log('\n📋 Secções encontradas:');
    document.sections.forEach((section, index) => {
      console.log(`${index + 1}. ${section.title} (Página ${section.page}) - Relevância: ${section.relevance}`);
      console.log(`   Conteúdo: ${section.content.substring(0, 100)}...`);
      console.log('');
    });
    
    // Gerar markdown para ver resultado
    const markdown = converter.generateMarkdown(document);
    console.log('\n📝 Markdown gerado (primeiras 1000 caracteres):');
    console.log(markdown.substring(0, 1000) + '...');
  } else {
    console.log('❌ Falha ao converter documento');
  }
}

debugConversion().catch(console.error);
