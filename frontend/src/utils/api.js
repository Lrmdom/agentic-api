import axios from 'axios'

// Usa o proxy do Vite em desenvolvimento, ou URL direta em produção
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor para logging
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('❌ API Request Error:', error)
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`)
    return response
  },
  (error) => {
    console.error('❌ API Response Error:', error)
    return Promise.reject(error)
  }
)

// Serviço unificado - Single Point of Truth
export const unifiedService = {
  // Endpoint principal - único ponto de entrada
  async sendMessage(query, options = {}) {
    const response = await api.post('/agent', {
      query,
      userId: options.userId || 'anonymous',
      debug: options.debug || false,
      forceTool: options.forceTool,
      forceStockCheck: options.forceStockCheck,
    })
    return response.data
  },

  // Health check
  async healthCheck() {
    const response = await api.get('/health')
    return response.data
  },

  // Estatísticas do sistema
  async getStats() {
    const response = await api.get('/stats')
    return response.data
  },

  // Teste de cenários
  async runTests(scenarios) {
    const response = await api.post('/test', { scenarios })
    return response.data
  },
}

export default unifiedService
