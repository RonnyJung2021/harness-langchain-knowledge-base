# 阶段 8：验证与交付 — 验收记录

对应 `offline-mode-harness-implementation-guide.md` **阶段 8**（§81、§82）。

---

## 81 自动化

| 验收项 | 结果 |
|--------|------|
| `client-offline-core` Vitest | 已存在；覆盖 **stubEmbed**（`stubEmbed.align.test.ts`）、**localRetrieve**（`localRetrieve.golden.test.ts`）、**runLocalRagTurn**（`localRagTurn.test.ts`）等 |
| 根目录 **`pnpm test`** 不要求 `ARK_API_KEY` | 已改为：`test:api-core` → `test:client-offline` → `test:app-shared` 串联；**`pnpm test` 已通过**（api-core 仍为占位 `(no tests)`，其余 Vitest 全绿） |
| Playwright「先同步 mock 再 mock offline」 | **未实现**（指南允许成本高则跳过）；发布前仍可跑 **`pnpm test:e2e`** 或设 **`E2E_SKIP=1`** |

**建议 CI**：在无浏览器环境执行 **`pnpm test`**（不含 E2E）；有浏览器与密钥时再跑 **`pnpm test:e2e`**。

---

## 82 文档与 REPOSITORY_ATLAS 增量

| 验收项 | 结果 |
|--------|------|
| README「离线」区分服务端 vs 端内 | 根 **`README.md`** 新增 **「### 离线模式：服务端 vs 端内完全离线」**（对照表、存储位置、**Web 离线 smoke 四步**） |
| 列出同步按钮、开关、存储位置 | 已写入上表与 **Web / RN 存储** 小节 |
| **`project-atlas/REPOSITORY_ATLAS.md`** | 顶层表增加 **`packages/client-offline-core`** 一行；**依赖与功能域** 补充 `web` / `app-shared` → `client-offline-core`；**测试** 小节更新为描述根 **`pnpm test`** 链 |

**「新贡献者按 README 可完成 Web 离线 smoke」**：以 README 中 **四步清单** 为准；仍需本机 **`pnpm serve` + `kb_store` + Admin Token**（与真实环境一致）。

---

## 回归命令

```bash
pnpm test
pnpm run typecheck
```
