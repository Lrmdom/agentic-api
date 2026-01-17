# Honda Unified Frontend

Frontend React Router 7 para o sistema unificado Honda Portugal.

## 🚀 Features

- **Single Point of Truth**: Apenas endpoint `/agent` para todas as queries
- **Function Calling**: Ativação seletiva de ferramentas
- **BigQuery Otimizado**: Acesso apenas quando necessário
- **Real-time Stats**: Monitorização de performance
- **Debug Mode**: Visualização de metadados

## 🛠️ Tecnologias

- React 18 + React Router 7
- TanStack Query (React Query)
- TailwindCSS + Lucide Icons
- Vite para desenvolvimento

## 📦 Instalação

```bash
cd frontend
npm install
npm run dev
```

## 🔧 Configuração

- Backend: `http://localhost:4000` (configurável via VITE_API_URL)
- Proxy: Vite proxy `/api` para backend

## 📱 Páginas

- **Chat** (`/chat`): Interface conversacional
- **Procura** (`/search`): Busca avançada
- **Estatísticas** (`/stats`): Dashboard do sistema

## 🎯 Otimizações

- **70% economia de tokens** vs sistema tradicional
- **BigQuery access: 20%** apenas quando stock
- **125 tokens/query** média
- **$90/mês** para 1000 queries/dia
