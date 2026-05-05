# kb-rag-mobile（Expo）

与 **`packages/app-shared`**、**`packages/design-system`** 共享业务 UI；REST 与 Web 一致，经 **`EXPO_PUBLIC_API_BASE_URL`** 指向后端（**勿**把方舟密钥打进 `EXPO_PUBLIC_*`）。

## 环境变量

复制 **`apps/mobile/.env.example`** 为 **`apps/mobile/.env`**（勿提交密钥）。常用：

| 变量 | 说明 |
|------|------|
| **`EXPO_PUBLIC_API_BASE_URL`** | API 根 URL，无尾斜杠。真机访问电脑：`http://<局域网IP>:8788`；**安卓模拟器**访问本机：`http://10.0.2.2:8788` |
| **`EXPO_PUBLIC_HTTP_ADMIN_TOKEN`** | 与根目录服务端 **`HTTP_ADMIN_TOKEN`** 一致时，可使用「替换知识库」上传 PDF |
| **`EXPO_PUBLIC_DS_SMOKE=1`** | 仅渲染设计系统验收屏 |

**禁止**：将 **`ARK_API_KEY`**、长期 **`HTTP_ADMIN_TOKEN`** 等敏感内容写入 `EXPO_PUBLIC_*`（会进入 JS bundle）。

## 依赖与路径

- **`babel-plugin-module-resolver`**：将 `@kb-rag/*` 解析到 **`packages/*/src`**（与 Web 侧直连源码的开发体验对齐）。
- **`metro.config.js`**：`watchFolders` 指向仓库根，便于 monorepo 解析。
- 仓库根脚本 **`pnpm dev:mobile`**：会先 `tsc` 构建 workspace 包；日常也可用 **`pnpm --filter kb-rag-mobile run start`**（若 Metro 已通过 Babel 编源码，仍建议改动 shared 后跑一次 workspace build 以免类型与产物漂移）。

## 本地运行（推荐）

在仓库根：

```bash
pnpm install
# 终端 A：启动 API（默认 8788）
pnpm serve
# 终端 B：启动 Metro
cd apps/mobile && npx expo start
```

按需按 **`a`** / **`i`** 打开 Android / iOS 模拟器；或使用 **`expo run:android`** / **`expo run:ios`** 生成并打开原生工程（需本机 Android Studio / Xcode）。

```bash
pnpm --filter kb-rag-mobile run android
pnpm --filter kb-rag-mobile run ios
```

## PDF 上传（替换知识库）

使用 **`expo-document-picker`** 选择 PDF；请求体为 **`multipart/form-data`**（`FormData` + `file` 字段），与 Web 端契约一致。需配置 **`EXPO_PUBLIC_HTTP_ADMIN_TOKEN`**；权限由 Expo / 系统文件选择器处理，无需额外相机/相册声明。

## EAS Build（可选）

已提供 **`apps/mobile/eas.json`** 占位 profile（`development` / `preview` / `production`）。首次使用：

```bash
npm i -g eas-cli
eas login
eas build:configure
eas build --profile preview --platform android
```

具体凭证、包名、签名需在 Expo 项目设置中补齐。

## 验收提示

- API 可用：模拟器上 **新会话 → 发送消息**；可选 **上传小 PDF**（配置 Admin Token）。
- API 不可用：`DiagnosticsPanel` 应显示网络/HTTP 失败；顶部横幅为 **`ApiRequestError`** 类人可读文案。
