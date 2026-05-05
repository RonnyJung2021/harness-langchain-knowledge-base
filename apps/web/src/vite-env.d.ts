/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 仅开发：替换知识库接口的 Bearer token，与根目录服务端 `HTTP_ADMIN_TOKEN` 一致。**勿提交到 git。** */
  readonly VITE_HTTP_ADMIN_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
