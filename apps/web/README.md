# kb-rag-web（Vite + react-native-web）

与 **`apps/mobile`** 共用 **`react-native` 0.76.7（与 Expo 锁定一致）**，避免双实例；`react-native-web` 仅用于 Web 构建。升级 Expo 时务必同步抬升 **`apps/web`** 中 **`react-native`** / **`react`**，并跑全仓库 **`pnpm -r run typecheck`**（详见 **`docs/PRODUCTION_SECURITY_V4.md`**「4.1」）。

## `react-native` → `react-native-web`（Vite）

[RN Web 文档](https://necolas.github.io/react-native-web/)建议通过打包工具将 `react-native` 解析到 `react-native-web`。本仓库使用 **绝对路径** 指向 `node_modules/react-native-web`（见 `vite.config.ts`），以避免部分环境下裸 specifier 解析失败。

若你改为字符串别名：

```ts
alias: { "react-native": "react-native-web" }
```

仍无法解析时，保留当前绝对路径写法即可。

### Metro-less 限制（Workaround）

- Vite 无 Metro：`*.native.tsx` 优先级与 Expo 不同；业务组件应放在 **`packages/app-shared`** 且只用跨平台 API。
- 若遇个别包深层 `require('react-native/Libraries/...')` 失败：优先换用 RN-web 支持的 API，或在 `vite.config.ts` 的 `resolve.alias` 增加针对性映射（逐案记录）。

## 响应式同源（无独立 m 站）

- **同一 URL**：不做 UA 跳转其它主机；仅依赖窗口宽度切换布局（见 `@kb-rag/app-shared` 内 `useWorkspaceLayout`）。
- **Chrome DevTools**：同一地址下切换 iPhone / 桌面宽度即可验收；宽屏壳 **`max-width: 880px`** 居中。

## 本地开发

```bash
# 终端 A（仓库根）
pnpm serve

# 终端 B
pnpm dev:web
```

设计系统验收：`VITE_DS_SMOKE=1`（见 `.env.example`）。

## 端内离线（IndexedDB）

- **`apps/web/src/App.tsx`** 注入 **`createWebIndexedDbKbBundleStore()`**，与 RN 侧 `KbBundleStore` 语义一致：可在「连接自检」中 **同步知识库到本机**，再在 **主动离线 / 浏览器离线** 下走本机 RAG（占位回答）。  
- 依赖 **`@kb-rag/client-offline-core`**（`vite.config.ts` 已 alias 到源码）；运行时路径不含 **`node:fs`**（该包源码侧无 Node 专属 API）。  
- **Service Worker**（`public/sw.js`）仍不缓存 **`/v1/*`**；向量快照存 **IndexedDB**，与 SW 无关。
