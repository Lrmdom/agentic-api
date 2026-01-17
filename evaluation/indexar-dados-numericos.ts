import { FinalIndexer } from '../src/final-indexer.js';
import { SimpleExtractor } from '../src/simple-extractor.js';

interface DadoNumerico {
  valor: number;
  unidade: string;
  especificacao: string;
  modelo: string;
  contexto: string;
  pagina: string;
  tipo: 'folga' | 'torque' | 'pressao' | 'dimensao' | 'capacidade' | 'outro';
  precisao: 'exata' | 'range' | 'aproximada';
}

class IndexadorNumerico {
  private indexer: FinalIndexer;
  private dadosNumericos: DadoNumerico[] = [];

  constructor() {
    this.indexer = new FinalIndexer();
  }

  private extrairDadosNumericosDoTexto(text: string, modelo: string): DadoNumerico[] {
    const dados: DadoNumerico[] = [];
    
    // Padrões específicos para cada tipo de dado
    const padroes = [
      {
        tipo: 'folga' as const,
        regex: /folga[^:]*:?\s*(\d+(?:\s*-\s*\d+)?)[\s]*mm/gi,
        unidade: 'mm',
        especificacao: 'Folga'
      },
      {
        tipo: 'torque' as const,
        regex: /(\d+(?:\.\d+)?)[\s]*(Nm|kgf·m)/gi,
        unidade: 'Nm',
        especificacao: 'Torque'
      },
      {
        tipo: 'pressao' as const,
        regex: /(\d+(?:\.\d+)?)[\s]*(bar|psi|kPa)/gi,
        unidade: 'bar',
        especificacao: 'Pressão'
      },
      {
        tipo: 'capacidade' as const,
        regex: /capacidade[^:]*:?\s*(\d+(?:\.\d+)?)[\s]*(l|litros)/gi,
        unidade: 'L',
        especificacao: 'Capacidade'
      },
      {
        tipo: 'dimensao' as const,
        regex: /(\d+(?:\.\d+)?)[\s]*mm(?![^]*folga)/gi,
        unidade: 'mm',
        especificacao: 'Dimensão'
      }
    ];

    for (const padrao of padroes) {
      let match;
      while ((match = padrao.regex.exec(text)) !== null) {
        const valorStr = match[1];
        const unidadeMatch = match[2] || padrao.unidade;
        
        // Extrair contexto
        const start = Math.max(0, match.index - 100);
        const end = Math.min(text.length, match.index + match[0].length + 100);
        const contexto = text.substring(start, end).replace(/\s+/g, ' ').trim();
        
        // Encontrar página
        let pagina = 'N/A';
        const paginaMatch = contexto.match(/Página\s*(\d+)/i);
        if (paginaMatch) {
          pagina = paginaMatch[1];
        }
        
        // Determinar precisão
        let precisao: 'exata' | 'range' | 'aproximada' = 'exata';
        if (valorStr.includes('-')) {
          precisao = 'range';
        } else if (contexto.includes('cerca') || contexto.includes('aproximadamente')) {
          precisao = 'aproximada';
        }
        
        // Converter valor para número (handle ranges)
        let valor: number;
        if (valorStr.includes('-')) {
          const [min, max] = valorStr.split('-').map(v => parseFloat(v.trim()));
          valor = (min + max) / 2; // Usar média do range
        } else {
          valor = parseFloat(valorStr.replace(',', '.'));
        }
        
        if (!isNaN(valor)) {
          dados.push({
            valor,
            unidade: unidadeMatch,
            especificacao: padrao.especificacao,
            modelo,
            contexto,
            pagina,
            tipo: padrao.tipo,
            precisao
          });
        }
      }
    }
    
    return dados;
  }

  async indexarDadosNumericos() {
    console.log('🔍 INICIANDO INDEXAÇÃO NUMÉRICA...');
    
    try {
      // Extrair documentos usando o SimpleExtractor
      const extractor = new SimpleExtractor();
      const documentos = await extractor.extractAllDocuments();
      
      console.log(`📄 Processando ${documentos.length} documentos...`);
      
      for (const documento of documentos) {
        console.log(`📖 Processando: ${documento.model}`);
        
        // Extrair dados das especificações
        const dadosSpecs = this.extrairDadosNumericosDoTexto(documento.specifications, documento.model);
        
        // Extrair dados das funcionalidades (pode conter especificações)
        const dadosFeatures = this.extrairDadosNumericosDoTexto(documento.keyFeatures, documento.model);
        
        // Combinar dados
        const todosDados = [...dadosSpecs, ...dadosFeatures];
        
        // Remover duplicados
        const dadosUnicos = todosDados.filter((dado, index, self) => 
          index === self.findIndex((t) => 
            t.modelo === dado.modelo && 
            t.especificacao === dado.especificacao && 
            t.valor === dado.valor &&
            t.unidade === dado.unidade
          )
        );
        
        this.dadosNumericos.push(...dadosUnicos);
        console.log(`  ✅ ${dadosUnicos.length} dados numéricos extraídos`);
      }
      
      // Criar índice especializado para dados numéricos
      const indiceNumerico = {
        dados: this.dadosNumericos,
        timestamp: new Date().toISOString(),
        total: this.dadosNumericos.length,
        porModelo: this.agruparPorModelo(),
        porTipo: this.agruparPorTipo(),
        porEspecificacao: this.agruparPorEspecificacao()
      };
      
      // Salvar índice
      const fs = await import('fs');
      fs.writeFileSync('./indice-numerico.json', JSON.stringify(indiceNumerico, null, 2));
      
      console.log(`\n📊 ÍNDICE NUMÉRICO CRIADO:`);
      console.log(`  • Total de dados: ${this.dadosNumericos.length}`);
      console.log(`  • Modelos cobertos: ${Object.keys(indiceNumerico.porModelo).length}`);
      console.log(`  • Tipos de dados: ${Object.keys(indiceNumerico.porTipo).length}`);
      console.log(`  • Arquivo salvo: ./indice-numerico.json`);
      
      return indiceNumerico;
      
    } catch (error) {
      console.error('❌ Erro na indexação numérica:', error);
      throw error;
    }
  }

  private agruparPorModelo() {
    const agrupado: Record<string, DadoNumerico[]> = {};
    this.dadosNumericos.forEach(dado => {
      if (!agrupado[dado.modelo]) {
        agrupado[dado.modelo] = [];
      }
      agrupado[dado.modelo].push(dado);
    });
    return agrupado;
  }

  private agruparPorTipo() {
    const agrupado: Record<string, DadoNumerico[]> = {};
    this.dadosNumericos.forEach(dado => {
      if (!agrupado[dado.tipo]) {
        agrupado[dado.tipo] = [];
      }
      agrupado[dado.tipo].push(dado);
    });
    return agrupado;
  }

  private agruparPorEspecificacao() {
    const agrupado: Record<string, DadoNumerico[]> = {};
    this.dadosNumericos.forEach(dado => {
      const chave = `${dado.especificacao}_${dado.unidade}`;
      if (!agrupado[chave]) {
        agrupado[chave] = [];
      }
      agrupado[chave].push(dado);
    });
    return agrupado;
  }

  // Método para busca especializada
  buscarDadosNumericos(query: string, modelo?: string, tipo?: string): DadoNumerico[] {
    let resultados = this.dadosNumericos;
    
    // Filtrar por modelo se especificado
    if (modelo) {
      resultados = resultados.filter(d => 
        d.modelo.toLowerCase().includes(modelo.toLowerCase())
      );
    }
    
    // Filtrar por tipo se especificado
    if (tipo) {
      resultados = resultados.filter(d => d.tipo === tipo);
    }
    
    // Filtrar por query (busca textual no contexto e especificação)
    if (query) {
      const queryLower = query.toLowerCase();
      resultados = resultados.filter(d => 
        d.contexto.toLowerCase().includes(queryLower) ||
        d.especificacao.toLowerCase().includes(queryLower)
      );
    }
    
    return resultados;
  }

  // Gerar relatório da indexação
  gerarRelatorioIndexacao() {
    console.log('\n📋 RELATÓRIO DE INDEXAÇÃO NUMÉRICA');
    console.log('='.repeat(60));
    
    const porTipo = this.agruparPorTipo();
    
    console.log('\n📊 DADOS POR TIPO:');
    for (const [tipo, dados] of Object.entries(porTipo)) {
      console.log(`  ${tipo.toUpperCase()}: ${dados.length} ocorrências`);
      
      // Mostrar exemplos
      const exemplos = dados.slice(0, 3);
      exemplos.forEach((dado, i) => {
        console.log(`    ${i + 1}. ${dado.especificacao}: ${dado.valor} ${dado.unidade} (${dado.modelo})`);
      });
      
      if (dados.length > 3) {
        console.log(`    ... +${dados.length - 3} ocorrências`);
      }
    }
    
    const porModelo = this.agruparPorModelo();
    console.log('\n📱 DADOS POR MODELO:');
    for (const [modelo, dados] of Object.entries(porModelo)) {
      console.log(`  ${modelo.toUpperCase()}: ${dados.length} dados numéricos`);
    }
    
    console.log(`\n✅ Indexação concluída: ${this.dadosNumericos.length} dados numéricos indexados`);
  }
}

// Executar indexação
if (import.meta.url === `file://${process.argv[1]}`) {
  const indexador = new IndexadorNumerico();
  indexador.indexarDadosNumericos()
    .then(() => indexador.gerarRelatorioIndexacao())
    .catch(console.error);
}

export { IndexadorNumerico };
export type { DadoNumerico };
