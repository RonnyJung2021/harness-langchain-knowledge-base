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
export { useChatPanelDualMode } from "./hooks/useChatPanelDualMode.js";
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
export {
  OfflinePreferenceProvider,
  useOfflinePreference,
  type OfflinePreferenceContextValue,
  type OfflinePreferenceProviderProps,
} from "./offline/OfflinePreferenceProvider.js";
export { useEffectiveOffline } from "./offline/useEffectiveOffline.js";
export { effectiveOfflineForTesting, type EffectiveOfflineEnv } from "./offline/effectiveOffline.js";
export {
  KB_RAG_OFFLINE_PREF_PREFIX,
  PREFER_OFFLINE_STORAGE_KEY,
} from "./offline/offlinePrefStorage.js";
