import React from 'react'
import { Activity, Zap, Database, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react'
import { useStats, useHealthCheck, useRunTests } from '../hooks/useUnifiedAgent'

export function StatsPage() {
  const { data: stats, isLoading: statsLoading } = useStats()
  const { data: health, isLoading: healthLoading } = useHealthCheck()
  const { runTests, isLoading: testsLoading } = useRunTests()

  const handleRunTests = async () => {
    const scenarios = [
      "Qual a pressão dos pneus da PCX 125?",
      "Tem Honda Forza 350 em stock?",
      "Quantos utilizadores ativos agora?",
      "Olá, tudo bem?"
    ]
    
    await runTests.mutateAsync(scenarios)
  }

  if (statsLoading || healthLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-red-600" />
          Sistema Unificado - Estatísticas em Tempo Real
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Activity className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Requests</p>
                <p className="text-2xl font-bold text-blue-900">{stats?.totalRequests || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Zap className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-green-600 font-medium">Avg Response</p>
                <p className="text-2xl font-bold text-green-900">{stats?.averageResponseTime || 0}ms</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Database className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-purple-600 font-medium">BigQuery Rate</p>
                <p className="text-2xl font-bold text-purple-900">{((stats?.bigQueryAccessRate || 0) * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-yellow-600 mr-3" />
              <div>
                <p className="text-sm text-yellow-600 font-medium">Token Savings</p>
                <p className="text-2xl font-bold text-yellow-900">{stats?.costSavings?.tokenReduction || '0%'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Health Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium mb-4">Health Check</h3>
        
        <div className="flex items-center space-x-4">
          <div className={`flex items-center ${health?.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
            {health?.status === 'healthy' ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
            <span className="font-medium">
              Status: {health?.status || 'Unknown'}
            </span>
          </div>
          
          {health?.unifiedAgent && (
            <span className="text-sm text-gray-500">
              Unified Agent: {health.unifiedAgent}
            </span>
          )}
        </div>
      </div>

      {/* Tool Usage */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium mb-4">Tool Usage Distribution</h3>
        
        <div className="space-y-3">
          {Object.entries(stats?.toolUsage || {}).map(([tool, percentage]) => (
            <div key={tool} className="flex items-center">
              <div className="w-24 text-sm font-medium capitalize">{tool}</div>
              <div className="flex-1 mx-4 bg-gray-200 rounded-full h-6">
                <div 
                  className="bg-red-600 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${percentage * 100}%` }}
                >
                  {(percentage * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Savings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium mb-4">Cost Optimization</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600 font-medium">Token Reduction</p>
            <p className="text-xl font-bold text-green-900">{stats?.costSavings?.tokenReduction || '0%'}</p>
          </div>
          
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600 font-medium">Cost Reduction</p>
            <p className="text-xl font-bold text-blue-900">{stats?.costSavings?.costReduction || '0%'}</p>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-600 font-medium">BigQuery Reduction</p>
            <p className="text-xl font-bold text-purple-900">{stats?.costSavings?.bigQueryReduction || '0%'}</p>
          </div>
        </div>
      </div>

      {/* Test Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium mb-4">System Tests</h3>
        
        <button
          onClick={handleRunTests}
          disabled={testsLoading}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testsLoading ? 'Running Tests...' : 'Run System Tests'}
        </button>
        
        <p className="text-sm text-gray-500 mt-2">
          Testa todos os cenários: Manuais, Catálogo, Analytics, Conversa
        </p>
      </div>
    </div>
  )
}
