import { expect, test } from "@playwright/test";

test.describe("首页对话冒烟", () => {
  test.beforeEach(({}, testInfo) => {
    if (process.env.E2E_SKIP === "1") {
      testInfo.skip(true, "已设置 E2E_SKIP=1");
    }
    if (process.env.ARK_API_KEY === undefined || process.env.ARK_API_KEY.trim() === "") {
      testInfo.skip(true, "缺少 ARK_API_KEY：请在仓库根 .env 配置方舟密钥后再运行 pnpm test:e2e");
    }
  });

  test("新会话 → 发送短句 → 出现助手消息", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("btn-new-session").click();
    await expect(page.getByTestId("chat-input")).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId("chat-input").fill("E2E 冒烟：请仅回复 pong。");
    await page.getByTestId("btn-send").click();
    const firstAssistant = page.getByTestId("assistant-message").first();
    await expect(firstAssistant).toBeVisible({ timeout: 120_000 });
    await expect(firstAssistant).toHaveText(/\S/, { timeout: 5_000 });
  });
});
