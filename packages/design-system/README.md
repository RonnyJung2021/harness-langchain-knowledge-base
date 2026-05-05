# @kb-rag/design-system

跨 **Web（react-native-web）** 与 **React Native** 的最小设计系统：`tokens`、`ThemeProvider（light / dark stub）`、`react-native` 原语导出。

## Web（Vite）

业务代码从 `react-native` 引入的组件需映射到 `react-native-web`。本仓库在 **`apps/web/vite.config.ts`** 中配置：

```ts
resolve: {
  alias: {
    "react-native": path.resolve(__dirname, "node_modules/react-native-web"),
  },
},
```

否则会出现无法解析 `react-native` 或构建失败。

## 主题

- `ThemeProvider` 接收 `colorScheme?: "light" | "dark"`；`dark` 为 **stub**（neutral 与语义色已反转占位，可后续精调）。
- `useTheme()` 返回 `{ tokens, colorScheme }`。

## 验收屏

导出 **`DesignSystemSmoke`**：展示 neutral 阶梯、间距、语义色与 `Pressable` 按下态。在应用中设置：

- Web：`VITE_DS_SMOKE=1`（见 `apps/web/.env.example`）
- Expo：`EXPO_PUBLIC_DS_SMOKE=1`（见 `apps/mobile/.env.example`）

即可全屏查看，便于与移动端截图对照节奏（字体渲染差异可忽略）。
