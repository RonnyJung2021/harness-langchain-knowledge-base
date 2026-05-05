export { KbWorkspaceApp, type KbWorkspaceAppProps } from "./KbWorkspaceApp.js";
export {
  KbBundleStoreProvider,
  useKbBundleStore,
  type KbBundleStoreProviderProps,
} from "./context/KbBundleStoreContext.js";
export { ChatPanel, type ChatPanelProps } from "./panels/ChatPanel.js";
export { DiagnosticsPanel, type DiagnosticsPanelProps } from "./panels/DiagnosticsPanel.js";
export { KbReplacePanel, type KbReplacePanelProps } from "./panels/KbReplacePanel.js";
export { useSessionApi } from "./hooks/useSessionApi.js";
export { useChatPanel } from "./hooks/useChatPanel.js";
export { postKbReplaceMultipart, type PdfFileLike } from "./hooks/useKbReplace.js";
export {
  ApiRequestError,
  errorToBannerText,
  fetchJson,
  postSessionMessageStream,
  type ApiRequestErrorInit,
  type PostSessionMessageStreamResult,
} from "./api/httpApi.js";
export { resolveApiUrl } from "./api/apiClient.js";
export { warnIfNativeMissingApiBase } from "./config/nativeApiGuard.js";
export {
  KB_BUNDLE_SYNC_ERROR_CODES,
  KbBundleSyncError,
  kbBundleSyncErrorToUserMessage,
  parseKbBundleResponseBody,
  syncKbBundleFromServer,
  type KbBundleSyncErrorCode,
} from "./offline/syncKbBundle.js";
export { useLikelyOnline } from "./offline/useLikelyOnline.js";
