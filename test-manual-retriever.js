import { ManualRetriever } from './dist/src/manual-retriever.js';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Inicializa o Genkit
const ai = genkit({
    plugins: [
        googleAI({apiKey: process.env.GEMINI_API_KEY}),
    ],
});

async function testManualRetriever() {
    console.log('🧪 Testando Manual Retriever...');
    
    try {
        // Inicializa o retriever
        const retriever = new ManualRetriever(ai);
        
        // Testa indexação
        console.log('📚 Iniciando indexação...');
        await retriever.indexManuals();
        console.log('✅ Indexação concluída!');
        
        // Testa busca
        console.log('🔍 Testando busca...');
        const results = await retriever.retrieveRelevantDocuments('como trocar óleo', 3);
        
        console.log(`📊 Encontrados ${results.length} resultados:`);
        results.forEach((result, index) => {
            console.log(`\n--- Resultado ${index + 1} ---`);
            console.log(`Fonte: ${result.filename}`);
            console.log(`Score: ${result.score.toFixed(4)}`);
            console.log(`Texto: ${result.text.substring(0, 200)}...`);
        });
        
        console.log('\n🎉 Teste concluído com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }
}

testManualRetriever();
