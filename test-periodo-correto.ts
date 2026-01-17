import { EnhancedCatalogService } from './src/enhanced-catalog-service.js';

async function testComPeriodoCorreto() {
  console.log('🔍 **TESTANDO COM PERÍODO CORRETO (incluindo reservas existentes)**\n');
  
  const service = new EnhancedCatalogService();

  try {
    // Testar com setembro-outubro 2025 (incluindo as reservas de 17/09)
    console.log('📅 Buscando em 17/09 a 20/10 (período COM reservas PCX)...');
    const results = await service.searchWithAvailability(
      'PCX 125', 
      '2025-09-17', 
      '2025-10-20', 
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
        '2025-09-17',
        '2025-10-20',
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

    console.log('\n✅ **Teste concluído com sucesso!**');

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  }
}

testComPeriodoCorreto();
