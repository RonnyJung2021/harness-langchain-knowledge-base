import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Playwright / 本机多实例时可通过环境变量指向其它 API 端口（默认 8787） */
const apiPort = process.env.VITE_API_PORT ?? "8787";
const apiOrigin = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/v1": { target: apiOrigin, changeOrigin: true },
      "/healthz": { target: apiOrigin, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
