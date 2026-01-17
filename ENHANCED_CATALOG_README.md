# Catálogo Aprimorado com Verificação de Disponibilidade

Esta implementação adiciona funcionalidades avançadas de busca de catálogo com verificação de disponibilidade em tempo real, integrando a tabela de eventos do BigQuery.

## 🚀 Funcionalidades Implementadas

### 1. Busca Vectorial com Disponibilidade
- **VECTOR_SEARCH** usando `text-embedding-004` para busca semântica
- **JOIN** com tabela de eventos `events-data-table` 
- Verificação de disponibilidade em tempo real
- Suporte a parâmetros opcionais `data_inicio` e `data_fim`

### 2. Lógica de Disponibilidade
- Marca resultados como **"Disponível"** ou **"Indisponível"**
- Usa `PARSE_DATE` para comparar datas corretamente (strings → datas)
- Verifica sobreposição de períodos de reserva
- Retorna motivo da indisponibilidade quando aplicável

### 3. Campos Adicionais
- `store_location`: Localização da loja
- `formatted_total_amount_with_taxes`: Preço completo com impostos
- `prices`: Detalhes completos de preços
- `description`: Descrição do veículo

### 4. Sistema de Alternativas
- Busca automática de alternativas disponíveis
- Prioriza veículos disponíveis no período solicitado
- Formata resumo comercial para o agente IA

## 📁 Arquivos Criados

### Core Service
- `src/enhanced-catalog-service.ts` - Serviço principal com lógica de negócio

### API Routes  
- `src/routes/enhanced-catalog.ts` - Endpoints REST para a funcionalidade

### MCP Server
- `src/mcp/enhanced-catalog-server.ts` - Servidor MCP para integração com Genkit

### Testes
- `test-enhanced-catalog.ts` - Script de validação da funcionalidade

## 🔧 Configuração

### 1. Atualização de Rotas
O router `enhanced-catalog` foi adicionado ao `src/index.ts`:
```typescript
app.route("/enhanced-catalog", enhancedCatalogRouter);
```

### 2. Configuração MCP
O servidor `enhanced-catalog` foi adicionado a `src/mcp/servers.ts`:
```typescript
{
  name: "enhanced-catalog",
  command: "npx",
  args: ["tsx", path.resolve(process.cwd(), "src/mcp/enhanced-catalog-server.ts")],
  env: {},
}
```

## 🛠️ Endpoints Disponíveis

### REST API
- `POST /enhanced-catalog/search` - Busca com verificação de disponibilidade
- `POST /enhanced-catalog/find-alternatives` - Encontra alternativas disponíveis

### MCP Tools
- `search_enhanced_catalog` - Busca no catálogo com disponibilidade
- `find_available_alternatives` - Encontra alternativas 
- `check_vehicle_availability` - Verifica disponibilidade específica

## 📊 Exemplo de Uso

### Busca Simples
```json
{
  "query": "PCX 125",
  "top_k": 5
}
```

### Busca com Datas
```json
{
  "query": "PCX 125", 
  "data_inicio": "2026-02-01",
  "data_fim": "2026-02-05",
  "top_k": 5
}
```

### Resposta Esperada
```
**[FONTE: CATÁLOGO COM DISPONIBILIDADE]** Resultados encontrados para "PCX 125" no período de 2026-02-01 a 2026-02-05:

**Resultado 1**
📋 Modelo: Honda PCX 125
🏪 Localização: Lisboa  
💰 Preço: €45/dia
📅 Disponibilidade: Indisponível
⚠️ Motivo: Reservado de 2026-01-30 até 2026-02-03 (ID: 12345)

**Resultado 2**
📋 Modelo: Honda SH 125
🏪 Localização: Porto
💰 Preço: €42/dia  
📅 Disponibilidade: Disponível
```

## 🎯 Objetivo Comercial

O agente IA agora pode responder:

> "Encontrei a PCX 125 que procura, mas nesse período ela já está reservada em Lisboa. Tenho disponível a SH 125 no Porto."

## 🔍 Detalhes Técnicos

### SQL Query Principal
```sql
WITH vector_results AS (
  SELECT base.*, ML.COSINE_DISTANCE(base.embedding, embedding) AS distance
  FROM VECTOR_SEARCH(TABLE master_catalog_rag, 'embedding', 
    (SELECT ml_generate_embedding_result FROM ML.GENERATE_EMBEDDING(...)))
),
existing_bookings AS (
  SELECT vehicleModel, store_location, start_Date, end_Date
  FROM events-data-table 
  WHERE status = 'approved' OR payment_status = 'paid'
)
SELECT vr.*, 
  CASE WHEN EXISTS(...) THEN 'Indisponível' ELSE 'Disponível' END AS disponibilidade
FROM vector_results vr
```

### Tratamento de Datas
- Usa `PARSE_DATE('%Y-%m-%d', dateString)` para converter strings
- Compara períodos com operadores `<=` e `>=`
- Verifica sobreposição: `(start1 <= end2) AND (end1 >= start2)`

## 🧪 Testes

Execute o script de testes:
```bash
npx tsx test-enhanced-catalog.ts
```

O script testa:
1. Busca simples sem datas
2. Busca com datas (verificação de disponibilidade)
3. Sistema de alternativas
4. Busca genérica

## 🚀 Próximos Passos

1. **Integração com Frontend**: Consumir os novos endpoints
2. **Cache**: Implementar cache para consultas frequentes
3. **Notificações**: Alertas quando veículos ficam disponíveis
4. **Analytics**: Métricas de busca e disponibilidade

## 📝 Notas Importantes

- As datas na tabela de eventos são strings e precisam ser convertidas
- O JOIN usa `vehicleModel` para conexão (poderia usar `sku_code` para mais precisão)
- O sistema prioriza resultados disponíveis sobre indisponíveis
- Alternativas são buscadas automaticamente quando há indisponibilidade
