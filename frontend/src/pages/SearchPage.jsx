import React, { useState } from 'react'
import { Search, Filter, Zap, Database, TrendingUp } from 'lucide-react'
import { useUnifiedAgent } from '../hooks/useUnifiedAgent'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [forceTool, setForceTool] = useState('')
  const [forceStockCheck, setForceStockCheck] = useState(false)
  const [results, setResults] = useState([])
  const { sendMessage, isLoading } = useUnifiedAgent()

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim() || isLoading) return

    try {
      const result = await sendMessage.mutateAsync({
        query,
        options: { 
          debug: true,
          forceTool: forceTool || undefined,
          forceStockCheck: forceStockCheck || undefined
        }
      })

      setResults([{
        id: Date.now(),
        query,
        reply: result.reply,
        metadata: result.metadata,
        timestamp: new Date()
      }, ...results])
    } catch (error) {
      console.error('Search error:', error)
    }
  }

  const exampleQueries = [
    { category: 'Catálogo', queries: ['Qual o preço da PCX 125?', 'Tem Forza 350 em stock?', 'Modelos disponíveis'] },
    { category: 'Manuais', queries: ['Pressão dos pneus PCX', 'Ajuste folga acelerador', 'Capacidade de óleo'] },
    { category: 'Analytics', queries: ['Utilizadores ativos', 'Estatísticas do site', 'Tráfego atual'] },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Search className="w-5 h-5 mr-2 text-red-600" />
          Procura Unificada Honda
        </h2>
        
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Main Search Input */}
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquise informações sobre motos Honda..."
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              disabled={isLoading}
            />
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
          </div>

          {/* Advanced Options */}
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1 min-w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Forçar Ferramenta
              </label>
              <select
                value={forceTool}
                onChange={(e) => setForceTool(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Automático</option>
                <option value="catalog">Catálogo</option>
                <option value="manuals">Manuais</option>
                <option value="analytics">Analytics</option>
                <option value="none">Nenhuma</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={forceStockCheck}
                  onChange={(e) => setForceStockCheck(e.target.checked)}
                  className="mr-2"
                />
                Forçar BigQuery (Stock)
              </label>
            </div>

            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              ) : (
                'Pesquisar'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Example Queries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {exampleQueries.map((category) => (
          <div key={category.category} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">{category.category}</h3>
            <div className="space-y-2">
              {category.queries.map((example) => (
                <button
                  key={example}
                  onClick={() => setQuery(example)}
                  className="block w-full text-left text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                >
                  • {example}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Resultados da Procura</h3>
          
          {results.map((result) => (
            <div key={result.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Query: {result.query}
                  </p>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap mb-2">
                    {result.reply}
                  </div>
                </div>
                <div className="text-xs text-gray-500 ml-4">
                  {result.timestamp.toLocaleTimeString()}
                </div>
              </div>
              
              {result.metadata && (
                <div className="flex items-center space-x-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                  <span className="flex items-center">
                    <Zap className="w-3 h-3 mr-1" />
                    Tool: {result.metadata.toolUsed || 'none'}
                  </span>
                  <span className="flex items-center">
                    <Database className="w-3 h-3 mr-1" />
                    BigQuery: {result.metadata.bigQueryAccess ? 'YES' : 'NO'}
                  </span>
                  <span>~{result.metadata.tokenEstimate} tokens</span>
                  <span className="flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {result.metadata.responseTime}ms
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
