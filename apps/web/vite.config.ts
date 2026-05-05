import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * 将 `import … from "react-native"` 映射到 react-native-web（与 RN Web 文档一致）。
 * 使用 **目录绝对路径** 而非裸 `"react-native-web"`，避免个别 Rollup/Vite 解析到错误入口；
 * 详见 `apps/web/README.md`「Metro-less 限制」。
 */
const reactNativeWebRoot = path.resolve(__dirname, "node_modules/react-native-web");

/** Playwright / 本机多实例时可通过环境变量指向其它 API 端口（默认 8788） */
const apiPort = process.env.VITE_API_PORT ?? "8788";
const apiOrigin = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "react-native": reactNativeWebRoot,
      "@kb-rag/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@kb-rag/design-system": path.resolve(__dirname, "../../packages/design-system/src/index.ts"),
      "@kb-rag/app-shared": path.resolve(__dirname, "../../packages/app-shared/src/index.ts"),
    },
    extensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".jsx", ".js", ".mjs"],
    },
    include: ["react-native-web"],
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": { target: apiOrigin, changeOrigin: true },
      "/healthz": { target: apiOrigin, changeOrigin: true },
      "/readyz": { target: apiOrigin, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
