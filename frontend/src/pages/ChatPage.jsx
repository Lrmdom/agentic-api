import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Zap, Database } from 'lucide-react'
import { useUnifiedAgent } from '../hooks/useUnifiedAgent'

export function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [debugMode, setDebugMode] = useState(false)
  const messagesEndRef = useRef(null)
  const { sendMessage, isLoading } = useUnifiedAgent()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = { role: 'user', content: input, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])

    try {
      const result = await sendMessage.mutateAsync({
        query: input,
        options: { debug: debugMode }
      })

      const assistantMessage = {
        role: 'assistant',
        content: result.reply,
        metadata: result.metadata,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage = {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem.',
        error: true,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    }

    setInput('')
  }

  const renderMessage = (message, index) => {
    const isUser = message.role === 'user'
    
    return (
      <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`flex items-start max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-500 ml-3' : 'bg-red-500 mr-3'}`}>
            {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
          </div>
          
          <div className={`message-bubble ${isUser ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200'} rounded-lg px-4 py-2 max-w-2xl`}>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            
            {message.metadata && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span className="flex items-center">
                    <Zap className="w-3 h-3 mr-1" />
                    {message.metadata.toolUsed || 'none'}
                  </span>
                  <span className="flex items-center">
                    <Database className="w-3 h-3 mr-1" />
                    BigQuery: {message.metadata.bigQueryAccess ? 'YES' : 'NO'}
                  </span>
                  <span>~{message.metadata.tokenEstimate} tokens</span>
                </div>
              </div>
            )}
            
            <div className="text-xs text-gray-400 mt-1">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Debug Mode Toggle */}
      <div className="bg-yellow-50 border-b border-yellow-200 p-3">
        <label className="flex items-center text-sm">
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(e) => setDebugMode(e.target.checked)}
            className="mr-2"
          />
          Modo Debug (ver metadados)
        </label>
      </div>

      {/* Messages Container */}
      <div className="chat-container flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">Assistente Virtual Honda Portugal</h3>
            <p className="text-sm">Olá! Como posso ajudar com as motos Honda hoje?</p>
            <div className="mt-4 text-xs text-gray-400">
              <p>Sistema Unificado • Single Point of Truth</p>
              <p>Function Calling • BigQuery Otimizado</p>
            </div>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4 bg-white">
        <div className="flex space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua pergunta sobre motos Honda..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
