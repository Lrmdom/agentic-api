import { useMutation, useQuery } from '@tanstack/react-query'
import { unifiedService } from '../utils/api'

// Hook principal para o unified agent - Single Point of Truth
export function useUnifiedAgent() {
  const sendMessage = useMutation({
    mutationFn: ({ query, options }) => unifiedService.sendMessage(query, options),
    onSuccess: (data) => {
      console.log('✅ Unified Agent Response:', data)
    },
    onError: (error) => {
      console.error('❌ Unified Agent Error:', error)
    },
  })

  return {
    sendMessage,
    isLoading: sendMessage.isPending,
    error: sendMessage.error,
  }
}

// Hook para health check
export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: unifiedService.healthCheck,
    refetchInterval: 30000, // 30 segundos
    retry: 2,
  })
}

// Hook para estatísticas
export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: unifiedService.getStats,
    refetchInterval: 60000, // 1 minuto
    retry: 1,
  })
}

// Hook para testes
export function useRunTests() {
  const runTests = useMutation({
    mutationFn: (scenarios) => unifiedService.runTests(scenarios),
    onSuccess: (data) => {
      console.log('✅ Test Results:', data)
    },
    onError: (error) => {
      console.error('❌ Test Error:', error)
    },
  })

  return {
    runTests,
    isLoading: runTests.isPending,
    error: runTests.error,
  }
}
