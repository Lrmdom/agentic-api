import { EnhancedCatalogService } from './src/enhanced-catalog-service.js';

async function testComReservasReais() {
  console.log('🔍 **TESTANDO COM RESERVAS REAIS EXISTENTES**\n');
  
  const service = new EnhancedCatalogService();

  try {
    // Testar com setembro-outubro 2025 (período com reservas PCX 125 reais)
    console.log('📅 Buscando em set-out 2025 (período com reservas PCX 125)...');
    const results = await service.searchWithAvailability(
      'PCX 125', 
      '2025-09-20', 
      '2025-10-10', 
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
      console.log('🎯 **VEÍCULOS INDISPONÍVEIS (RESERVADOS):**');
      unavailable.slice(0, 3).forEach((item, i) => {
        console.log(`${i+1}. ${item.title}`);
        console.log(`   📍 Local: ${item.store_location || 'N/A'}`);
        console.log(`   📦 SKU: ${item.sku_code || 'N/A'}`);
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
        console.log(`   📦 SKU: ${item.sku_code || 'N/A'}`);
        console.log(`   💰 Preço: ${item.formatted_total_amount_with_taxes || 'N/A'}`);
        console.log('');
      });
    }

    // Testar alternativas se houver indisponíveis
    if (unavailable.length > 0) {
      console.log('🔄 **BUSCANDO ALTERNATIVAS...**');
      const alternatives = await service.findAlternatives(
        'PCX 125',
        '2025-09-20',
        '2025-10-10',
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

    // Testar também com scooter genérico
    console.log('\n📅 **Testando com "scooter" genérico no mesmo período...**');
    const scooterResults = await service.searchWithAvailability(
      'scooter', 
      '2025-09-20', 
      '2025-10-10', 
      5
    );

    const scooterUnavailable = scooterResults.filter(r => r.disponibilidade === 'Indisponível');
    console.log(`📊 Scooters: ${scooterResults.length} resultados, ${scooterUnavailable.length} indisponíveis`);

    if (scooterUnavailable.length > 0) {
      console.log('🔴 **Scooters Indisponíveis:**');
      scooterUnavailable.forEach((item, i) => {
        console.log(`${i+1}. ${item.title} - ${item.motivo_indisponibilidade}`);
      });
    }

    console.log('\n✅ **Teste concluído com sucesso!**');

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  }
}

testComReservasReais();
