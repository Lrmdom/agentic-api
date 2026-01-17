# Prompts de Teste para Sistema RAG/MCP

## 🎯 Prompts Específicos por Categoria

### 📊 Binário/Torque (Teste Negativo - dados não existentes)
```
Qual o torque de aperto do parafuso do cabeçote no motor da Honda Forza 125?
```
```
Qual o valor de torque recomendado para as porcas do motor da SH 125?
```
```
Qual o binário de aperto da junta do cabeçote na PCX 125?
```
```
Quais os valores de torque para montagem do motor da Vision 110?
```
```
Qual o aperto recomendado para os parafusos do cilindro na CBR 650R?
```

### 📏 Folga (Teste Positivo - dados existentes)
```
Qual a folga recomendada no acelerador da Honda Forza 125?
```
```
Qual o valor da folga do punho do acelerador na SH 125?
```
```
Qual a regulagem da folga do acelerador na PCX 125?
```
```
Qual a folga na flange do punho do acelerador na Vision 110?
```
```
Qual a folga do acelerador na CBR 650R?
```

### 🎈 Pressão (Teste Negativo - dados não existentes)
```
Qual a pressão recomendada para os pneus da Honda Forza 125?
```
```
Qual a calibragem dos pneus dianteiro e traseiro na SH 125?
```
```
Qual a pressão de inflação dos pneus na PCX 125?
```
```
Quais os valores de pressão para os pneus da Vision 110?
```
```
Qual a pressão dos pneus na CBR 650R?
```

## 🔍 Prompts de Variação Linguística

### Sinônimos e Variações para Folga
```
Qual o jogo do acelerador da Forza 125?
```
```
Qual a regulagem do acelerador na SH 125?
```
```
Qual a folga entre o punho e o cabo do acelerador na PCX 125?
```
```
Qual o ajuste do acelerador na Vision 110?
```
```
Qual a folga na manete do acelerador na CBR 650R?
```

### Variações para Binário
```
Qual o aperto em Newton-metro do motor da Forza 125?
```
```
Quais os valores de aperto em kgf·m para a SH 125?
```
```
Qual o torque especificado em Nm para a PCX 125?
```
```
Qual o binário de aperto em kgf·m para a Vision 110?
```
```
Quais os torques de montagem em Nm para a CBR 650R?
```

### Variações para Pressão
```
Qual a calibragem em bar para os pneus da Forza 125?
```
```
Qual a pressão em psi para os pneus da SH 125?
```
```
Qual a inflação em kPa para a PCX 125?
```
```
Qual a pressão dos pneus em kgf/cm² para a Vision 110?
```
```
Quais os valores de pressão em bar para a CBR 650R?
```

## 🎯 Prompts Contextuais

### Consultas Específicas de Manutenção
```
Durante a manutenção da Honda Forza 125, qual a folga que devo verificar no acelerador?
```
```
Estou ajustando o acelerador da SH 125, qual o valor correto da folga?
```
```
Para regular o acelerador da PCX 125, qual a especificação de folga?
```
```
No manual da Vision 110, qual a folga recomendada para o acelerador?
```
```
Segundo o manual da CBR 650R, qual a folga do acelerador?
```

### Consultas Comparativas
```
Compare a folga do acelerador entre a Forza 125 e a SH 125
```
```
Qual a diferença na folga do acelerador entre PCX 125 e Vision 110?
```
```
Todas as motos Honda têm a mesma folga de acelerador? Compare Forza, SH, PCX e Vision
```

## 🚀 Prompts Avançados

### Multi-dados
```
Quais as especificações de folga do acelerador e torque de aperto para a Honda Forza 125?
```
```
Forneça todos os dados numéricos de manutenção para a SH 125 (folga, torque, pressão)
```
```
Quais os valores técnicos importantes para a PCX 125 incluindo folga do acelerador?
```

### Contexto de Problema
```
Minha Honda Forza 125 está com acelerador duro, qual a folga devo verificar?
```
```
O acelerador da SH 125 não retorna, qual o valor de folga devo ajustar?
```
```
Como regular o acelerador da PCX 125 corretamente? Qual a folga ideal?
```

## 📋 Prompts de Teste de Sistema

### Teste de Capacidade
```
Liste todos os valores numéricos de manutenção encontrados no manual da Honda Forza 125
```
```
Quais todas as especificações técnicas em mm encontradas para a SH 125?
```
```
Extraia todos os dados numéricos com unidades do manual da PCX 125
```

### Teste de Limites
```
Qual o torque do parafuso número 17 do cabeçote da Forza 125? (muito específico)
```
```
Qual a pressão do pneu traseiro esquerdo da SH 125 em alta velocidade? (detalhe excessivo)
```
```
Qual a folga do acelerador em milímetros com precisão de 3 casas decimais? (precisão excessiva)
```

## 🎮 Como Usar

### Teste Básico
1. Use os prompts da primeira seção para testar funcionalidade básica
2. Verifique se o sistema responde corretamente para folga (positivo)
3. Confirme se o sistema lida bem com ausência de dados (binário/pressão)

### Teste Avançado
1. Use prompts de variação linguística para testar robustez
2. Teste prompts contextuais para verificar compreensão
3. Use prompts comparativos para testar capacidade de análise

### Teste de Stress
1. Use prompts multi-dados para testar extração simultânea
2. Teste prompts de problema para verificar aplicação prática
3. Use prompts de limite para testar respostas a consultas impossíveis

## 📊 Cenários de Teste Esperados

### ✅ Cenários de Sucesso
- Folga do acelerador: deve retornar "2 - 6 mm"
- Contexto preservado: deve mencionar "flange do punho do acelerador"
- Consistência: todos os modelos devem retornar valores similares

### ⚠️ Cenários de Resposta Esperada
- Binário/Pressão: deve informar que dados não foram encontrados
- Consultas impossíveis: deve responder que não há informação suficiente
- Variações linguísticas: deve entender sinônimos

### ❌ Cenários de Falha a Monitorar
- Não responder a consultas válidas
- Retornar valores incorretos
- Perder contexto importante
- Não lidar bem com variação linguística
