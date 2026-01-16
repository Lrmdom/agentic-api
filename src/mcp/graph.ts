import { StateGraph, START, END } from "@langchain/langgraph";
import { MarketingState } from "./state.js";
import { ToolMessage } from "@langchain/core/messages";
import {
  agentNode,
  identityNode,
  commerceNode,
  executionNode,
  ga4RealtimeTool,
} from "./nodes.js";

function shouldContinue(state: any) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage?.tool_calls && lastMessage.tool_calls.length > 0) {
    console.log(`🎯 Tool Call detectada: ${lastMessage.tool_calls[0].name}`);
    return "tools";
  }
  return "identity";
}

export async function createMarketingOS() {
  const workflow = new StateGraph(MarketingState)
    .addNode("agent", agentNode)
    .addNode("tools", async (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      const results = [];

      for (const call of lastMessage.tool_calls) {
        if (call.name === "get_ga4_realtime_users") {
          const out = await ga4RealtimeTool.invoke(call);
          results.push(out);
        }
        // Adiciona aqui o else para chamar mcpManager.callTool se necessário
      }
      return { messages: results };
    })
    .addNode("identity", identityNode)
    .addNode("commerce", commerceNode)
    .addNode("action", executionNode);

  workflow.addEdge(START, "agent");

  // Decisão: ou vai para as ferramentas, ou segue o fluxo de negócio
  workflow.addConditionalEdges("agent", shouldContinue, {
    tools: "tools",
    identity: "identity",
  });

  // ⚡️ VOLTA AO AGENTE após a ferramenta para ele ler o JSON e escrever texto
  workflow.addEdge("tools", "agent");

  workflow.addEdge("identity", "commerce");
  workflow.addEdge("commerce", "action");
  workflow.addEdge("action", END);

  return workflow.compile();
}
