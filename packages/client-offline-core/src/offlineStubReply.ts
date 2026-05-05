/**
 * 与 `packages/api-core/src/providers/offline/stubInference.ts` 中 `OFFLINE_REPLY` **全文一致**，
 * 端内 V1 占位生成不依赖 api-core（避免拉入 Node/LangChain）。
 */
export const OFFLINE_STUB_REPLY =
  "（离线占位）当前为离线模式，未调用方舟大模型。检索步骤已执行；此为固定占位答复，后续可替换为本地 ONNX / llama 等推理后端。";
