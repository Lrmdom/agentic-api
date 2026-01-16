// Exemplos de queries para o sistema de manuais técnicos

const exemplosQueries = [
  // Manutenção básica
  {
    "query": "como trocar o óleo do motor",
    "topK": 3
  },
  {
    "query": "qual a capacidade do óleo da forja 350",
    "topK": 2
  },
  
  // Especificações técnicas
  {
    "query": "especificações do motor SH125 2022",
    "topK": 3
  },
  {
    "query": "potência e torque da PCX125",
    "topK": 2
  },
  
  // Sistema elétrico
  {
    "query": "localização da bateria VISION NSC110",
    "topK": 3
  },
  {
    "query": "como verificar fusíveis FORZA 350",
    "topK": 2
  },
  
  // Pneus e rodas
  {
    "query": "pressão dos pneus PCX125 2021",
    "topK": 3
  },
  {
    "query": "tamanho do pneu traseiro FORZA125",
    "topK": 2
  },
  
  // Sistema de freio
  {
    "query": "como ajustar freio traseiro SH125",
    "topK": 3
  },
  {
    "query": "fluido de freio recomendado FORZA 350",
    "topK": 2
  },
  
  // Problemas comuns
  {
    "query": "motor não pega partida elétrica",
    "topK": 3
  },
  {
    "query": "motocicleta perde força em subidas",
    "topK": 3
  },
  
  // Consumo e performance
  {
    "query": "consumo de combustível PCX125",
    "topK": 2
  },
  {
    "query": "velocidade máxima FORZA 350",
    "topK": 2
  }
];

console.log("Exemplos de queries para testar o sistema de manuais:");
console.log(JSON.stringify(exemplosQueries, null, 2));
