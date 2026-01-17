import { EnhancedCatalogService } from './src/enhanced-catalog-service.js';

async function testEnhancedCatalog() {
  console.log('🧪 Testando o serviço de catálogo aprimorado...\n');

  const catalogService = new EnhancedCatalogService();

  try {
    // Teste 1: Busca simples sem datas
    console.log('📋 Teste 1: Busca simples sem datas');
    console.log('Query: "PCX 125"');
    const results1 = await catalogService.searchWithAvailability('PCX 125');
    console.log(`Resultados: ${results1.length}`);
    if (results1.length > 0) {
      console.log('Primeiro resultado:', {
        title: results1[0].title,
        location: results1[0].store_location,
        availability: results1[0].disponibilidade,
        price: results1[0].formatted_total_amount_with_taxes
      });
    }
    console.log('---\n');

    // Teste 2: Busca com datas (simulando período futuro)
    console.log('📅 Teste 2: Busca com datas');
    const futureStartDate = '2026-02-01';
    const futureEndDate = '2026-02-05';
    console.log(`Query: "PCX 125" de ${futureStartDate} a ${futureEndDate}`);
    const results2 = await catalogService.searchWithAvailability('PCX 125', futureStartDate, futureEndDate);
    console.log(`Resultados: ${results2.length}`);
    results2.forEach((result: any, index: number) => {
      console.log(`Resultado ${index + 1}:`, {
        title: result.title,
        location: result.store_location,
        availability: result.disponibilidade,
        reason: result.motivo_indisponibilidade
      });
    });
    console.log('---\n');

    // Teste 3: Buscar alternativas
    console.log('🔄 Teste 3: Buscar alternativas');
    console.log(`Query: "scooter 125" de ${futureStartDate} a ${futureEndDate}`);
    const alternatives = await catalogService.findAlternatives('scooter 125', futureStartDate, futureEndDate, 3);
    console.log(`Disponíveis: ${alternatives.available.length}`);
    console.log(`Indisponíveis: ${alternatives.unavailable.length}`);
    console.log('Resumo:', alternatives.summary);
    console.log('---\n');

    // Teste 4: Busca genérica
    console.log('🔍 Teste 4: Busca genérica');
    console.log('Query: "moto para cidade"');
    const results4 = await catalogService.searchWithAvailability('moto para cidade', futureStartDate, futureEndDate, 3);
    console.log(`Resultados: ${results4.length}`);
    results4.forEach((result: any, index: number) => {
      console.log(`Resultado ${index + 1}:`, {
        title: result.title,
        location: result.store_location,
        availability: result.disponibilidade,
        distance: result.distance
      });
    });

    console.log('\n✅ Todos os testes concluídos com sucesso!');

  } catch (error: any) {
    console.error('❌ Erro durante os testes:', error);
    console.error('Stack trace:', error?.stack);
  }
}

// Executar testes
if (import.meta.url === `file://${process.argv[1]}`) {
  testEnhancedCatalog()
    .then(() => {
      console.log('🎉 Testes finalizados');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Falha nos testes:', error);
      process.exit(1);
    });
}

export { testEnhancedCatalog };
