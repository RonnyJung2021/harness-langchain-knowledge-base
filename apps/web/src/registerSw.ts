/** 仅在生产构建注册 SW，避免干扰 Vite HMR；SW 脚本位于 `public/sw.js`。 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) {
    return;
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
    /* 静默失败：PWA 为可选能力 */
  });
}
