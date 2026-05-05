# 阶段 5 / 6 / 7 验收记录（Web · RN · 安全与错误文案）

本文档对应 `offline-mode-harness-implementation-guide.md` 中 **阶段 5、6、7** 的实现与自动化验证结果；**手工联调（52、62）** 仍以清单形式列出，供发布前勾选。

---

## 阶段 5：Web 集成

### 51 Vite 与依赖打包

| 项 | 结果 |
|----|------|
| `apps/web` 依赖 `@kb-rag/client-offline-core`（`workspace:*`） | 已加 |
| `packages/app-shared` 已有该依赖 | 保持 |
| `vite.config.ts` `resolve.alias` → `@kb-rag/client-offline-core` 源码入口 | 已加 |
| 运行时 bundle 不含 `node:fs` | `client-offline-core` **源码**无 `node:fs`；`node:fs` 仅见于 **测试** 与 **vitest 配置** |
| `pnpm run typecheck`（含 `apps/web`） | 通过 |
| `pnpm run build:web` | 通过 |
| 产物体积 baseline（一次构建样本） | **`dist/` 合计约 304KB**；主 JS **`index-*.js` 约 294KB（约 96KB gzip）** |

### 52 联调清单（Web，手工）

- [ ] 在线：同步 → 对话正常。  
- [ ] DevTools Offline：勾选主动离线或未勾选但 offline → 仍能对话（需已同步 bundle + 本地会话）。  
- [ ] 未同步 + 离线 → 横幅为可读中文（`OFFLINE_NO_BUNDLE` 等）。  

---

## 阶段 6：React Native（Android / iOS）集成

### 61 依赖与权限

| 项 | 结果 |
|----|------|
| `apps/mobile` 显式依赖 `@react-native-community/netinfo` | 已加（与 app-shared 一致） |
| `KbBundleStore` 在 `App.tsx` 注入 | 已有 `createRnKbBundleStore()` → `KbWorkspaceApp` |
| iOS `Info.plist` ATS | 已含 **`NSAllowsLocalNetworking=true`**、**`NSAllowsArbitraryLoads=false`**；开发机 HTTP API 走本地网络例外；纯离线管道不触发外网 ATS |

### 62 联调清单（Native，手工）

- [ ] Android 飞行模式 + 已同步：对话可用。  
- [ ] iOS 飞行模式 + 已同步：对话可用。  
- [ ] 大 bundle：`pnpm dev:mobile` 双端可开「连接自检」开关；超大数据产品化加载态另议。  

---

## 阶段 7：安全、错误与 Harness 回归

### 71 密钥与日志

| 项 | 结果 |
|----|------|
| `grep -R "ARK_API_KEY" packages/client-offline-core` | **无匹配**（已自测）；fixture 中曾出现的字面量已改为中性描述 |
| `packages/client-offline-core/src` 内 `console.log` | **无** |
| 同步接口鉴权 | 仍仅 **Admin Bearer**；无方舟密钥进入 client-offline-core |

### 72 错误码与用户可见翻译

| 项 | 结果 |
|----|------|
| `packages/shared/src/offlineUi.ts` | 定义 **`OFFLINE_USER_ERROR_CODES`** 与 **`offlineUserBannerMessage` / `offlineRagFailureUserBanner`**（中文横幅） |
| 双模式聊天 | `useChatPanelDualMode` 使用上述 API，不再硬编码 `[OFFLINE_*]` 技术前缀句 |
| 同步失败 | `DiagnosticsPanel` 同步失败行以 **`OFFLINE_SYNC_FAILED`** 对应中文起句，并拼接现有 `kbBundleSyncErrorToUserMessage` |
| 诊断网络提示 | `runStep` 的 Native 网络提示正则已扩展 **主动离线 / 有效离线 / 飞行模式** 等关键词 |

---

## 自动化命令（回归）

在仓库根依次执行：

```bash
pnpm install
pnpm --filter @kb-rag/shared run build   # 更新 shared dist 后再查依赖它的包
pnpm run typecheck
pnpm run build:web
pnpm run test:client-offline
pnpm --filter @kb-rag/app-shared run test
grep -R "ARK_API_KEY" packages/client-offline-core || true
```
