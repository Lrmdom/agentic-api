#!/bin/bash

echo "🚀 INICIANDO SISTEMA COMPLETO HONDA"
echo "===================================="

echo ""
echo "🔍 Verificando portas..."
check_port() {
    if lsof -i :$1 > /dev/null 2>&1; then
        echo "❌ Porta $1 já está em uso"
        return 1
    else
        echo "✅ Porta $1 livre"
        return 0
    fi
}

check_port 3000 || exit 1
check_port 4004 || exit 1
check_port 4001 || echo "⚠️ Genkit UI já em execução"

echo ""
echo "📦 Instalando dependências (se necessário)..."
if [ ! -d "node_modules" ]; then
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    cd frontend && npm install && cd ..
fi

echo ""
echo "🎯 Opções de inicialização:"
echo ""
echo "1️⃣  npm run dev:full     - Backend + Frontend (recomendado)"
echo "2️⃣  npm run dev          - Apenas Backend"
echo "3️⃣  npm run frontend:dev  - Apenas Frontend"
echo ""

echo "🌐 URLs após inicialização:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:4004"
echo "   Genkit UI: http://localhost:4001"
echo ""

echo "🚀 Iniciando sistema completo..."
echo "   Backend: Genkit + MCP servers"
echo "   Frontend: Vite + React Router 7"
echo ""

# Inicia ambos os serviços
npm run dev:full
