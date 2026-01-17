import { EnhancedCatalogService } from './src/enhanced-catalog-service.js';

async function testExistingBookings() {
  console.log('🔍 **TESTANDO COM PERÍODO COM RESERVAS**\n');
  
  const service = new EnhancedCatalogService();

  try {
    // Testar com maio de 2025 (período passado com reservas)
    console.log('📅 Buscando em maio 2025 (período com reservas existentes)...');
    const results = await service.searchWithAvailability(
      'Honda', 
      '2025-05-01', 
      '2025-05-31', 
      8
    );

    console.log(`📊 Resultados encontrados: ${results.length}\n`);

    // Separar por disponibilidade
    const unavailable = results.filter(r => r.disponibilidade === 'Indisponível');
    const available = results.filter(r => r.disponibilidade === 'Disponível');
    const notChecked = results.filter(r => r.disponibilidade === 'Não verificado');

    console.log(`🔴 Indisponíveis: ${unavailable.length}`);
    console.log(`✅ Disponíveis: ${available.length}`);
    console.log(`❓ Não verificados: ${notChecked.length}\n`);

    // Mostrar exemplos de indisponíveis
    if (unavailable.length > 0) {
      console.log('🎯 **VEÍCULOS INDISPONÍVEIS:**');
      unavailable.slice(0, 3).forEach((item, i) => {
        console.log(`${i+1}. ${item.title}`);
        console.log(`   📍 Local: ${item.store_location || 'N/A'}`);
        console.log(`   ⚠️  Motivo: ${item.motivo_indisponibilidade}`);
        console.log('');
      });
    }

    // Mostrar exemplos de disponíveis
    if (available.length > 0) {
      console.log('✅ **VEÍCULOS DISPONÍVEIS:**');
      available.slice(0, 3).forEach((item, i) => {
        console.log(`${i+1}. ${item.title}`);
        console.log(`   📍 Local: ${item.store_location || 'N/A'}`);
        console.log(`   💰 Preço: ${item.formatted_total_amount_with_taxes || 'N/A'}`);
        console.log('');
      });
    }

    // Testar alternativas se houver indisponíveis
    if (unavailable.length > 0) {
      console.log('🔄 **BUSCANDO ALTERNATIVAS PARA MODELO INDISPONÍVEL...**');
      const alternatives = await service.findAlternatives(
        unavailable[0].title,
        '2025-05-01',
        '2025-05-31',
        5
      );

      console.log(`\n📊 Alternativas: ${alternatives.available.length} disponíveis, ${alternatives.unavailable.length} indisponíveis`);
      
      if (alternatives.available.length > 0) {
        console.log('\n🎯 **ALTERNATIVAS DISPONÍVEIS:**');
        alternatives.available.slice(0, 3).forEach((item, i) => {
          console.log(`${i+1}. ${item.title} - ${item.store_location}`);
        });
      }
    }

    console.log('✅ **Teste concluído com sucesso!**');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testExistingBookings();
