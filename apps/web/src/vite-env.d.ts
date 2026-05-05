/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 仅开发：替换知识库接口的 Bearer token，与根目录服务端 `HTTP_ADMIN_TOKEN` 一致。**勿提交到 git。** */
  readonly VITE_HTTP_ADMIN_TOKEN?: string;
  /** 设为 `1` 时全屏展示 `@kb-rag/design-system` 的 DesignSystemSmoke 验收组件 */
  readonly VITE_DS_SMOKE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
