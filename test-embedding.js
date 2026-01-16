import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Inicializa o Genkit
const ai = genkit({
    plugins: [
        googleAI({apiKey: process.env.GEMINI_API_KEY}),
    ],
});

async function testEmbedding() {
    try {
        console.log('🧪 Testando estrutura do embedding...');
        
        const result = await ai.embed({
            embedder: 'googleai/text-embedding-004',
            content: 'teste de embedding'
        });
        
        console.log('Estrutura completa:', JSON.stringify(result, null, 2));
        console.log('Keys:', Object.keys(result));
        
        if (result.embeddings) {
            console.log('Embeddings length:', result.embeddings.length);
            console.log('First embedding type:', typeof result.embeddings[0]);
            console.log('First embedding length:', result.embeddings[0]?.length);
        }
        
        if (result.embedding) {
            console.log('Embedding type:', typeof result.embedding);
            console.log('Embedding length:', result.embedding?.length);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

testEmbedding();
