import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Inicializa o Genkit
const ai = genkit({
    plugins: [
        googleAI({apiKey: process.env.GEMINI_API_KEY}),
    ],
});

async function testSingleEmbedding() {
    try {
        console.log('🧪 Testando estrutura de embedding...');
        
        const result = await ai.embed({
            embedder: 'googleai/text-embedding-004',
            content: 'teste simples'
        });
        
        console.log('Resultado completo:', result);
        console.log('Tipo:', typeof result);
        console.log('Keys:', Object.keys(result));
        console.log('É array?', Array.isArray(result));
        
        if (result.embeddings) {
            console.log('Tem embeddings:', result.embeddings.length);
            console.log('Primeiro embedding tipo:', typeof result.embeddings[0]);
            console.log('Primeiro embedding é array?', Array.isArray(result.embeddings[0]));
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

testSingleEmbedding();
