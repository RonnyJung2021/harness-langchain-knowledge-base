import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { extractAssistantTextFromInvokeContent } from "../../chat/ragFormatting.js";
import type { InferenceChatMessage, InferenceProvider } from "../types.js";
import { loadVolcanoArkEnvConfig } from "./arkEnv.js";

function toLangChainMessages(messages: InferenceChatMessage[]) {
  return messages.map((m) => {
    if (m.role === "system") {
      return new SystemMessage(m.content);
    }
    if (m.role === "assistant") {
      return new AIMessage(m.content);
    }
    return new HumanMessage(m.content);
  });
}

/**
 * 方舟对话（OpenAI 兼容 Chat）。在本类方法内按需构造 {@link ChatOpenAI}，读取 ARK_*。
 */
export class VolcanoArkChatProvider implements InferenceProvider {
  async chat(
    messages: InferenceChatMessage[],
    options?: {
      signal?: AbortSignal;
    },
  ): Promise<{
    content: string;
  }> {
    const cfg = loadVolcanoArkEnvConfig();
    const chat = new ChatOpenAI({
      model: cfg.chatModel,
      temperature: 0.2,
      apiKey: cfg.apiKey,
      timeout: cfg.requestTimeoutMs,
      configuration: { baseURL: cfg.baseUrl, timeout: cfg.requestTimeoutMs },
    });
    const res = await chat.invoke(toLangChainMessages(messages), {
      signal: options?.signal,
    });
    const content = extractAssistantTextFromInvokeContent(res.content).trim();
    return { content };
  }

  async chatStream(
    messages: InferenceChatMessage[],
    options: {
      signal?: AbortSignal;
      onTokenDelta: (delta: string) => void;
    },
  ): Promise<{
    content: string;
  }> {
    const cfg = loadVolcanoArkEnvConfig();
    const chat = new ChatOpenAI({
      model: cfg.chatModel,
      temperature: 0.2,
      apiKey: cfg.apiKey,
      timeout: cfg.requestTimeoutMs,
      configuration: { baseURL: cfg.baseUrl, timeout: cfg.requestTimeoutMs },
    });
    let acc = "";
    const stream = await chat.stream(toLangChainMessages(messages), {
      signal: options.signal,
    });
    for await (const chunk of stream) {
      const piece = extractAssistantTextFromInvokeContent(chunk.content);
      if (piece.length > 0) {
        acc += piece;
        options.onTokenDelta(piece);
      }
    }
    return { content: acc.trim() };
  }
}
