import type { InferenceChatMessage, InferenceProvider } from "../../providers/types.js";
import { OfflineModelUnavailableError } from "../errors.js";

/** `LOCAL_CHAT_REQUIRE=1` 但未配置 `LOCAL_CHAT_BASE_URL` 时使用。 */
export class OfflineChatRequiredButMissingProvider implements InferenceProvider {
  async chat(
    _messages: InferenceChatMessage[],
    _options?: { signal?: AbortSignal },
  ): Promise<{ content: string }> {
    throw new OfflineModelUnavailableError(
      "离线模式已设置 LOCAL_CHAT_REQUIRE=1，但未配置 LOCAL_CHAT_BASE_URL；无法连接本地推理服务。",
    );
  }

  async chatStream(
    _messages: InferenceChatMessage[],
    _options: {
      signal?: AbortSignal;
      onTokenDelta: (delta: string) => void;
    },
  ): Promise<{ content: string }> {
    throw new OfflineModelUnavailableError(
      "离线模式已设置 LOCAL_CHAT_REQUIRE=1，但未配置 LOCAL_CHAT_BASE_URL；无法连接本地推理服务。",
    );
  }
}
