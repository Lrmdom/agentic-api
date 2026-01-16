# Sistema de Indexação Seletiva de Manuais de Motos Honda

Este sistema transforma manuais PDF em markdown e indexa apenas o conteúdo relevante sobre especificações e funcionalidades das motos.

## 🚀 Funcionalidades

- **Extração Seletiva**: Identifica automaticamente páginas com especificações técnicas e funcionalidades
- **Conversão para Markdown**: Gera ficheiros markdown organizados por modelo
- **Indexação Inteligente**: Cria índice pesquisável com 646+ palavras-chave relevantes
- **Busca Avançada**: Interface de busca por palavras-chave, modelo ou tipo de conteúdo

## 📊 Modelos Disponíveis

- Honda Forza 350
- Honda Forza 125 (2021)
- Honda PCX 125 (2021)
- Honda SH 125 (2022)
- Honda Vision 110 (2017)

## 🛠️ Instalação e Uso

### 1. Construir o Índice

```bash
npx tsx build-final-index.js
```

Este processo:
- Extrai conteúdo relevante dos 5 manuais PDF
- Gera ficheiros markdown na pasta `./markdown/`
- Cria índice pesquisável em `./data/index.json`

### 2. Interface de Busca

```bash
npx tsx search-interface.js
```

#### Comandos Disponíveis:
- `especificações motor` - Busca por palavras-chave
- `modelo: forza 125` - Informações completas de um modelo
- `specs: sh 125` - Apenas especificações técnicas
- `features: pcx 125` - Apenas funcionalidades
- `sair` - Encerrar

### 3. Estrutura de Ficheiros

```
├── manuals/                 # PDFs originais
├── markdown/               # Markdown gerados
│   ├── Honda_Forza_350.md
│   ├── Honda_Forza_125.md
│   ├── Honda_PCX_125.md
│   ├── Honda_SH_125.md
│   └── Honda_Vision_110.md
├── data/
│   └── index.json         # Índice pesquisável
└── src/                   # Código fonte
    ├── simple-extractor.ts
    ├── final-indexer.ts
    └── ...
```

## 📈 Estatísticas do Sistema

- **5 modelos** processados
- **10 documentos** indexados (5 especificações + 5 funcionalidades)
- **646 palavras-chave** indexadas
- **Busca instantânea** por qualquer termo técnico

## 🔍 Tipos de Conteúdo Indexado

### Especificações Técnicas
- Motor e cilindrada
- Dimensões e peso
- Capacidade do depósito
- Suspensão e travões
- Transmissão
- Consumo e performance

### Funcionalidades e Equipamento
- Sistema Honda SMART Key
- ABS e travagem avançada
- Display e instrumentos
- Tomada USB
- Sistema de paragem ao ralenti
- Iluminação LED

## 🎯 Vantagens

- **Foco no Relevante**: Ignora conteúdo legal, avisos genéricos e informações não técnicas
- **Busca Eficiente**: Índice otimizado para consultas rápidas
- **Conteúdo Estruturado**: Markdown organizado para fácil leitura
- **Extensível**: Fácil adicionar novos modelos e manuais

## 🔧 Desenvolvimento

O sistema consiste em:

1. **SimpleExtractor**: Identifica páginas com conteúdo relevante
2. **FinalIndexer**: Cria índice pesquisável com palavras-chave
3. **Interface**: Sistema interativo de busca

Tudo desenvolvido em TypeScript/Node.js com PDF.js para processamento de PDFs.

---

## Setup Original

```bash
npm install
npm run dev
```

```bash
open http://localhost:3000
```
