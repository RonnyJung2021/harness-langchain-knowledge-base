# 知识库 RAG HTTP API（v1）

面向已实现阶段 M 的服务端：会话创建、拉取历史、发送一条用户消息并返回模型回答与引用摘要。字段名均为 **camelCase**。

**Base URL**：开发环境一般为 `http://127.0.0.1:8787`（端口由环境变量 `PORT` 控制）。

**前置**：已执行 `pnpm ingest` 写入 `kb_store`；已配置方舟 `ARK_*` 环境变量，否则 `POST .../messages` 会返回 `502` 及 `error.code: UPSTREAM`。

**探活与就绪**

- **`GET /healthz`**：不读盘、不调方舟；`200` `{ "ok": true, "ts": "..." }`，用于进程存活。
- **`GET /readyz`**：尝试读取仓库内 **`kb_store/manifest.json`**（轻量就绪）；成功 `200` `{ "ok": true, "kbManifestReadable": true, "ts": "...", "requestId"?: "..." }`；未入库或不可读 **`503`**，`error.code: NOT_READY`。不替代 `healthz`。

**错误体**：多数 JSON 错误为 `{ "error": { "code": "...", "message": "...", "requestId"?: "..." } }`，`requestId` 与响应头 **`X-Request-Id`** 一致（便于与 pino 日志关联）。常见：`429` **`RATE_LIMITED`**（消息接口限流，见 `HTTP_RATE_LIMIT_*`）；`413` **`PAYLOAD_TOO_LARGE`**（JSON body 超限，见 `HTTP_JSON_BODY_MAX_BYTES`）；`504` **`ARK_TIMEOUT`**（方舟 HTTP 超时，见 `ARK_REQUEST_TIMEOUT_MS`）。

环境变量说明见仓库根 **`.env.example`** 与 **`README.md`**「生产 checklist」。

---

## 1. 创建会话

`POST /v1/sessions`

**响应** `201`

```json
{ "sessionId": "550e8400-e29b-41d4-a716-446655440000" }
```

**示例**

```bash
curl -sS -X POST http://127.0.0.1:8787/v1/sessions
```

---

## 2. 获取会话消息列表

`GET /v1/sessions/:sessionId`

**响应** `200`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "messages": [
    {
      "id": "...",
      "role": "user",
      "content": "你好",
      "createdAt": "2026-05-04T12:00:00.000Z"
    },
    {
      "id": "...",
      "role": "assistant",
      "content": "...",
      "createdAt": "2026-05-04T12:00:05.000Z"
    }
  ]
}
```

**错误**

- `400` + `INVALID_SESSION_ID`：`sessionId` 不是合法 UUID。
- `404` + `SESSION_NOT_FOUND`：内存中不存在该会话。

**示例**

```bash
SID=$(curl -sS -X POST http://127.0.0.1:8787/v1/sessions | jq -r .sessionId)
curl -sS "http://127.0.0.1:8787/v1/sessions/${SID}"
```

---

## 3. 发送一条用户消息（RAG 一轮）

`POST /v1/sessions/:sessionId/messages`

**请求体** `application/json`

```json
{ "text": "请根据知识库简要说明……" }
```

**响应** `200`

```json
{
  "answer": "……",
  "citations": [
    {
      "index": 1,
      "sourceFile": "pdfs/sample.pdf",
      "chunkIndex": 0,
      "score": 0.42,
      "preview80": "……"
    }
  ],
  "degraded": false
}
```

`citations` 与 CLI `pnpm chat` 使用的 `CitationSummary` 一致（含 `index`、`sourceFile`、`chunkIndex`、`score`、`preview80`）。`degraded` 可选，含义与多轮 RAG 逻辑一致。

**错误**

- `400`：`INVALID_SESSION_ID`、`INVALID_BODY`、`EMPTY_TEXT`、`MESSAGE_TOO_LONG`（单条 `text` 长度上限由 `HTTP_CHAT_MAX_MESSAGE_CHARS` 控制，默认 8000）。
- `404`：`SESSION_NOT_FOUND`。
- `502`：`UPSTREAM`（方舟调用失败、向量未就绪等）；`message` 中会尽量附带可读说明。

**示例（连续两轮）**

```bash
BASE=http://127.0.0.1:8787
SID=$(curl -sS -X POST "${BASE}/v1/sessions" | jq -r .sessionId)

curl -sS -X POST "${BASE}/v1/sessions/${SID}/messages" \
  -H 'Content-Type: application/json' \
  -d '{"text":"第一条问题"}'

curl -sS -X POST "${BASE}/v1/sessions/${SID}/messages" \
  -H 'Content-Type: application/json' \
  -d '{"text":"第二条追问"}'

curl -sS "${BASE}/v1/sessions/${SID}" | jq '.messages | length'
```

成功时最后一条命令应输出 `4`（两条 user + 两条 assistant）。

---

## 3.1 流式发送（SSE，可选）

`POST /v1/sessions/:sessionId/messages:stream`

与非流式 `POST .../messages` **并存**：请求体相同（`application/json`，`{ "text": "..." }`），校验与 `502` / `404` 语义一致；成功时响应为 **`text/event-stream`**（SSE），而非单条 JSON。

**事件类型**（每条 SSE 帧含 `event:` 与单行 `data:`，`data` 为 JSON 字符串）：

| `event` | `data` JSON 形状 | 说明 |
|--------|------------------|------|
| `delta` | `{ "text": "<增量片段>" }` | 模型输出增量，可出现多次 |
| `done` | `{ "citations": [...], "degraded"?: boolean }` | **最后一帧**：与非流式响应中的 `citations` / `degraded` 一致（无 `answer` 字段；完整正文以流中所有 `delta` 拼接为准，且服务端已写入会话） |
| `error` | `{ "code": string, "message": string }` | 如模型/检索失败；帧后连接结束 |

**客户端说明**：

- 浏览器原生 **`EventSource` 仅支持 GET**，无法携带本接口所需的 **JSON POST body**，因此请使用 **`fetch` + `response.body.getReader()`**（或 axios/fetch 封装）按 SSE 规范以「空行」分隔事件帧；仓库内 React 示例见 `web/src/api.ts` 的 `postSessionMessageStream`。
- 若将来改为 GET + query 参数，才可用 `EventSource`；当前定案为 **POST**。

**curl 示例**（需 `--no-buffer` 才能实时看到 `delta`）：

```bash
SID=$(curl -sS -X POST http://127.0.0.1:8787/v1/sessions | jq -r .sessionId)

curl -sS --no-buffer -X POST "http://127.0.0.1:8787/v1/sessions/${SID}/messages:stream" \
  -H 'Content-Type: application/json' \
  -d '{"text":"你好"}'
```

---

## 4. 会话落盘

若设置 `ARK_SESSION_PERSIST=1`，与 `pnpm chat` 相同：每次向 store 追加消息后写入 `sessions/{sessionId}.json`。HTTP API 与 CLI 共用同一套 `createInMemorySessionStore` 行为。

---

## 5. 并发语义

同一 `sessionId` 上多条 `POST .../messages` 与 **`POST .../messages:stream`** 在服务端**串行**执行（同一队列），避免交错追加导致顺序错乱。

---

## 6. 替换知识库（multipart PDF）

`POST /v1/knowledge-base/replace`（与实现指南中的 `knowledge-base:replace` 同义；Express 路径使用 `/`）

**鉴权**：请求头 `Authorization: Bearer <HTTP_ADMIN_TOKEN>`，须与环境变量 `HTTP_ADMIN_TOKEN` 完全一致；未配置该变量或 token 错误 → `401` + `UNAUTHORIZED`。

**请求**：`multipart/form-data`，字段名 **`file`**，内容为 PDF。`Content-Type` 建议为 `application/pdf`；若为 `application/octet-stream` 但文件头为 `%PDF-`，亦接受。单文件大小上限由 **`KB_UPLOAD_MAX_BYTES`** 控制（默认 20MB），超出 → `413` + `PAYLOAD_TOO_LARGE`。

**响应** `200`

```json
{
  "sourceKey": "kb_uploads/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.pdf",
  "chunkCount": 12,
  "replacedAt": "2026-05-04T12:00:00.000Z"
}
```

成功后进程内向量库会**热重载**，后续 `POST .../messages` 使用新索引。若磁盘写入成功但内存加载失败 → `500` + `VECTOR_RELOAD_FAILED`（进程内索引会回滚到替换前引用；磁盘 `kb_store` 可能已更新，需查日志或重启）。

**互斥**：多次替换请求在服务端**全局串行**，避免并发 ingest 损坏 `kb_store`。

**错误码摘要**：`401` 鉴权；`400` `NO_FILE`；`413` `PAYLOAD_TOO_LARGE`；`415` `INVALID_MIME`；`500` `VECTOR_RELOAD_FAILED` 等。

**示例**

```bash
export HTTP_ADMIN_TOKEN=dev-secret   # 与 .env 中一致
curl -sS -X POST http://127.0.0.1:8787/v1/knowledge-base/replace \
  -H "Authorization: Bearer ${HTTP_ADMIN_TOKEN}" \
  -F "file=@pdfs/sample.pdf;type=application/pdf"
```

---

## 7. 类型定义（可选）

TypeScript 请求/响应形状见 `src/chat/httpShape.ts`（含 SSE `done` 载荷类型 `SseSessionMessageDonePayload`），与本文 JSON 字段对齐。
