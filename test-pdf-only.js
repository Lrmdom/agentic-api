import { PdfProcessor } from './dist/src/pdf-processor.js';

async function testPdfProcessing() {
    console.log('🧪 Testando processamento de PDFs...');
    
    try {
        const processor = new PdfProcessor();
        
        // Lista PDFs
        const pdfs = await processor.listPdfFiles();
        console.log('📄 PDFs encontrados:', pdfs);
        
        // Processa um PDF de teste
        if (pdfs.length > 0) {
            console.log(`📖 Processando: ${pdfs[0]}`);
            const doc = await processor.processPdfFile(pdfs[0]);
            
            if (doc) {
                console.log(`✅ Sucesso!`);
                console.log(`📄 Páginas: ${doc.metadata.pages}`);
                console.log(`📝 Título: ${doc.metadata.title || 'N/A'}`);
                console.log(`✍️ Autor: ${doc.metadata.author || 'N/A'}`);
                console.log(`📊 Conteúdo (primeiros 200 chars): ${doc.content.substring(0, 200)}...`);
                
                // Testa chunking
                const chunks = processor.chunkDocument(doc, 500, 100);
                console.log(`🔪 Chunks gerados: ${chunks.length}`);
                console.log(`📝 Primeiro chunk: ${chunks[0]?.text.substring(0, 100)}...`);
            } else {
                console.log('❌ Falha ao processar PDF');
            }
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

testPdfProcessing();
