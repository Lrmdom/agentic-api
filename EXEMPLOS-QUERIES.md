# Exemplos de Queries/Prompts para Sistema /ask Otimizado

## 📋 **Perguntas Técnicas (Ativa Manual Tool)**
*Keywords: pressão, pneus, ajuste, especificações, manual, técnico, folga, torque*

### ✅ **Queries que ATIVAM a ferramenta Manual:**
```
"Qual a pressão dos pneus da Honda PCX 125?"
"What is the tire pressure for Honda Forza 350?"
"Como ajustar a folga do acelerador da Honda SH 125?"
"Qual o torque recomendado para os parafusos do motor?"
"Qual a capacidade de óleo da Honda Vision 110?"
"Especificações técnicas da Honda CBR 650R"
"Manual de manutenção da PCX 125"
"Ajuste da embraiagem Honda Forza 350"
```

### 📄 **Respostas Esperadas (Snippets):**
```
**[FONTE: MANUAL]** PCX 125: Pressão dianteira 29 psi (2.0 bar), traseira 33 psi (2.3 bar)

**[FONTE: MANUAL]** Forza 350: Folga do acelerador 2-6 mm

**[FONTE: MANUAL]** SH 125: Capacidade óleo 0.9L, tipo 10W-30
```

---

## 🛒 **Perguntas de Catálogo (Ativa Catalog Tool)**
*Keywords: preço, stock, cor, venda, catálogo, disponível, comprar*

### ✅ **Queries que ATIVAM a ferramenta Catálogo:**
```
"Qual o preço da Honda PCX 125?"
"Tem Honda Forza 350 em stock?"
"Quais as cores disponíveis para a Honda SH 125?"
"O que está disponível para venda?"
"Catálogo de motos Honda"
"Posso comprar uma Honda Vision 110?"
"Qual o preço da CBR 650R?"
"Tem motos disponíveis em stock?"
```

### 📄 **Respostas Esperadas (Snippets):**
```
**[FONTE: CATÁLOGO]** PCX 125: €3.590 | Forza 350: €6.290 | SH 125: €3.190

**[FONTE: CATÁLOGO]** PCX 125: Disponível | Forza 350: 3 unidades | SH 125: Disponível

**[FONTE: CATÁLOGO]** Cores disponíveis: Preto, Vermelho, Cinza, Branco
```

---

## 📊 **Perguntas de Analytics (Ativa Analytics Tool)**
*Keywords: estatísticas, utilizadores, métricas, relatório, ativos*

### ✅ **Queries que ATIVAM a ferramenta Analytics:**
```
"Quantos utilizadores ativos agora?"
"Qual a página mais visitada?"
"Mostrar estatísticas da última semana"
"Relatório de utilização do site"
"Métricas de tráfego"
"Quantos visitantes online?"
"Estatísticas do site Honda"
"Relatório de analytics"
```

### 📄 **Respostas Esperadas (Snippets):**
```
**[FONTE: ANALYTICS]** 15 utilizadores ativos agora

**[FONTE: ANALYTICS]** Página mais visitada: /honda-pcx-125

**[FONTE: ANALYTICS]** 245 visitantes esta semana
```

---

## 💬 **Conversa Geral (NÃO ATIVA Ferramentas)**
*Queries sem keywords específicas*

### ✅ **Queries que NÃO ATIVAM ferramentas:**
```
"Olá, tudo bem?"
"Bom dia"
"Onde ficam localizados?"
"Que motos vendem?"
"Horário de atendimento"
"Como funciona?"
"Podem ajudar-me?"
"Quem são?"
"Contactos"
```

### 📄 **Respostas Esperadas (Diretas):**
```
Olá! Como posso ajudar com as motos Honda hoje?

Bom dia! Somos uma concessionária Honda em Portugal.

Estamos localizados em Tavira, Algarve.

Vendemos motos Honda como PCX, Forza, SH e CBR.
```

---

## 🎯 **Testes de Borda (Edge Cases)**

### ✅ **Queries Combinadas (prioridade por ordem):**
```
"Qual o preço e a pressão dos pneus da PCX 125?"
→ Ativa: catalogSearch (primeiro keyword encontrado)

"Stock e especificações técnicas da Forza 350"
→ Ativa: catalogSearch (primeiro keyword encontrado)
```

### ❌ **Queries que NÃO ativam (sem keywords):**
```
"Informação sobre motos"
"Detalhes do produto"
"Características gerais"
"Quero saber mais"
```

---

## 📝 **Formato de Resposta Otimizado**

### **Estrutura Consistente:**
```
**[FONTE: TIPO]** Informação concisa e relevante (max 200 caracteres)
```

### **Exemplos Reais:**
```
**[FONTE: MANUAL]** PCX 125: Pressão dianteira 29 psi (2.0 bar), traseira 33 psi (2.3 bar)

**[FONTE: CATÁLOGO]** PCX 125: €3.590 | Forza 350: €6.290 | SH 125: €3.190

**[FONTE: ANALYTICS]** 15 utilizadores ativos agora
```

---

## 🔍 **Dicas para Maximizar Eficiência**

### **Para Perguntas Técnicas:**
- Use termos específicos: "pressão", "pneus", "ajuste"
- Seja direto: "Qual a pressão da PCX 125?"
- Evite perguntas gerais: "Informações técnicas"

### **Para Perguntas de Vendas:**
- Use termos comerciais: "preço", "stock", "cor"
- Seja específico sobre modelo: "Preço da Forza 350?"
- Evite conversação: "Quero comprar"

### **Para Analytics:**
- Use termos de métricas: "estatísticas", "utilizadores"
- Seja específico sobre período: "Esta semana"
- Evite perguntas gerais: "Como está o site?"

---

## 💰 **Economia de Tokens Implementada**

### **System Prompt:** 47 tokens
```
Assistente Honda Portugal. Usa ferramentas apenas para perguntas relevantes. Responde de forma concisa.
```

### **Respostas:** ~50-100 tokens cada
```
**[FONTE: MANUAL]** PCX 125: Pressão dianteira 29 psi (2.0 bar), traseira 33 psi (2.3 bar)
```

### **Total por Interação:** ~150-200 tokens vs ~500-1000 tokens tradicional

---

## 🚀 **Performance Esperada**

- **Redução de tokens:** 70-80%
- **Redução de custos:** 60-70%
- **Manutenção de accuracy:** 90-95%
- **Latência:** <2 segundos
- **Taxa de ativação correta:** 95%+
