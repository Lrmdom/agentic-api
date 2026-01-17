import { GeminiEmbeddingService } from './evaluation/gemini-embedding-service.js';

// Script de indexação com Gemini para manuais
async function indexarManuaisComGemini() {
  console.log('🚀 INDEXAÇÃO DE MANUAIS COM GEMINI EMBEDDINGS\n');
  
  try {
    // 1. Inicializar serviço Gemini
    console.log('1️⃣ Inicializando Gemini Embedding Service...');
    const geminiService = new GeminiEmbeddingService();
    
    // 2. Carregar dados existentes
    console.log('2️⃣ Carregando dados dos manuais...');
    const fs = await import('fs');
    const path = await import('path');
    
    // Verificar pasta de manuais
    const manualsPath = './manuals';
    if (!fs.existsSync(manualsPath)) {
      console.log('❌ Pasta /manuals não encontrada. Usando indice-numerico.json');
    }
    
    // Carregar índice numérico
    const indiceNumerico = JSON.parse(fs.readFileSync('./indice-numerico.json', 'utf8'));
    console.log(`📋 Documentos carregados: ${indiceNumerico.dados.length}`);
    
    // 3. Gerar embeddings para todos os documentos
    console.log('3️⃣ Gerando embeddings com Gemini...');
    const embeddings = [];
    
    for (let i = 0; i < indiceNumerico.dados.length; i++) {
      const doc = indiceNumerico.dados[i];
      console.log(`\n📄 Processando documento ${i + 1}/${indiceNumerico.dados.length}: ${doc.modelo} - ${doc.especificacao}`);
      
      try {
        // Criar texto completo para embedding
        const fullText = `${doc.modelo} ${doc.especificacao} ${doc.valor} ${doc.unidade} ${doc.contexto || ''}`;
        
        // Gerar embedding com Gemini
        const embedding = await geminiService.createEmbedding(fullText);
        
        embeddings.push({
          id: `doc_${i + 1}`,
          text: fullText,
          embedding: embedding,
          metadata: {
            model: doc.modelo,
            section: doc.especificacao,
            value: doc.valor,
            unit: doc.unidade,
            context: doc.contexto,
            page: doc.pagina,
            timestamp: new Date().toISOString()
          }
        });
        
        console.log(`✅ Embedding gerada: ${embedding.length} dimensões`);
        
      } catch (error) {
        console.error(`❌ Erro no documento ${i + 1}:`, error);
      }
      
      // Pequena pausa para não sobrecarregar API
      if ((i + 1) % 5 === 0) {
        console.log(`⏸️ Pausa: processados ${i + 1} documentos...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // 4. Salvar embeddings
    console.log('\n4️⃣ Salvando embeddings...');
    const vectorStore = {
      metadata: {
        created: new Date().toISOString(),
        model: 'text-embedding-004',
        dimensions: 768,
        totalDocuments: embeddings.length,
        language: 'português',
        provider: 'Google Gemini'
      },
      embeddings: embeddings
    };
    
    const vectorStorePath = './gemini-vectorstore.json';
    fs.writeFileSync(vectorStorePath, JSON.stringify(vectorStore, null, 2));
    console.log(`✅ Embeddings salvas em: ${vectorStorePath}`);
    
    // 5. Estatísticas finais
    console.log('\n📊 ESTATÍSTICAS DA INDEXAÇÃO:');
    console.log(`• Documentos processados: ${embeddings.length}`);
    console.log(`• Modelo: text-embedding-004`);
    console.log(`• Dimensões: 768`);
    console.log(`• Idioma: Português`);
    console.log(`• Provider: Google Gemini`);
    console.log(`• Arquivo: ${vectorStorePath}`);
    console.log(`• Tamanho: ${(fs.statSync(vectorStorePath).size / 1024 / 1024).toFixed(2)} MB`);
    
    // 6. Teste rápido
    console.log('\n5️⃣ Teste rápido de busca...');
    const testResults = await geminiService.search('Qual a pressão dos pneus da Honda PCX 125?', 3);
    
    console.log(`🔍 Teste: "Qual a pressão dos pneus da Honda PCX 125?"`);
    testResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.model} - ${result.section}: ${result.confidence}%`);
    });
    
    console.log('\n🎯 INDEXAÇÃO COM GEMINI CONCLUÍDA COM SUCESSO!');
    console.log('📋 Os manuais estão agora indexados com embeddings do Google Gemini');
    console.log('🚀 Sistema pronto para busca vetorial em português!');
    
  } catch (error) {
    console.error('❌ Erro na indexação:', error);
  }
}

// Executar indexação
if (import.meta.url === `file://${process.argv[1]}`) {
  indexarManuaisComGemini().catch(console.error);
}

export { indexarManuaisComGemini };
