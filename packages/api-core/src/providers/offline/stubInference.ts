import type { InferenceChatMessage, InferenceProvider } from "../types.js";

const OFFLINE_REPLY =
  "（离线占位）当前为离线模式，未调用方舟大模型。检索步骤已执行；此为固定占位答复，后续可替换为本地 ONNX / llama 等推理后端。";

export class OfflineStubInferenceProvider implements InferenceProvider {
  async chat(
    _messages: InferenceChatMessage[],
    _options?: {
      signal?: AbortSignal;
    },
  ): Promise<{
    content: string;
  }> {
    return { content: OFFLINE_REPLY };
  }

  async chatStream(
    _messages: InferenceChatMessage[],
    options: {
      signal?: AbortSignal;
      onTokenDelta: (delta: string) => void;
    },
  ): Promise<{
    content: string;
  }> {
    options.onTokenDelta(OFFLINE_REPLY);
    return { content: OFFLINE_REPLY };
  }
}
