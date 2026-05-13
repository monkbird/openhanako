# Bug 修复跟踪

> 与 CHANGE_LOG.md 对照，实时记录修复进度。
> 开始日期：2026-05-12

---

## 批次一：Bridge/社交平台接入

### #664 — 微信 Bridge 无法收发图片和文件

**状态**：✅ 已修复
**文件**：`lib/bridge/bridge-manager.js`, `lib/bridge/wechat-adapter.js`, `lib/bridge/media-delivery-service.js`, `server/routes/providers.js`
**修复**：
1. `_appendPendingAttachments` 预下载覆盖全附件类型（不再仅限于 image）
2. `media-delivery-service.js` `_sendSessionFile` buffer 模式失败后自动 fallthrough 到 public_url 模式
3. WeChat `sendMediaBuffer` 的 context_token 缺失时抛出明确中文错误
4. `server/routes/providers.js` `normalizeRemoteModels` 三个分支补全 `image` 字段透传（修复 #839）

### #777 — 创建第二个助手后无法连接微信

**状态**：🔍 排查中
**分析**：Bridge-manager 已支持 per-agent 路由（`_getPlatformKey` → `platform:agentId`），`autoStart` 也遍历所有 agent 配置。可能是第二个助手的 bridge 配置未包含 botToken，或 UI 侧未正确传递 agentId。

### #747 — 微信频道 /new bot 无响应

**状态**：🔍 排查中
**分析**：`_rotateBridge` 逻辑正常（删 `file` 引用后下次消息会创建新 session）。问题可能是微信频道（Channel）模式的会话 key 在 rotate 后不一致，或 iLink 频道的 `from_user_id` 不稳定。

### #650 — 接收文件提示"文件已过期"

**状态**：📋 平台限制
**分析**：iLink CDN 的 `encrypt_query_param` 有服务端 TTL。适配器侧无法延长。建议配置 `bridge_media_public_base_url` 走自托管绕过。

### #624 — 发截图给飞书报错 image_key

**状态**：✅ 已修复
**文件**：`lib/bridge/feishu-adapter.js`
**修复**：`sendMediaBuffer` 的 `res.data`/`res.data.image_key`/`res.data.file_key` 增加 null 检查，缺失时抛出明确中文错误

### #737 — 无法接入 TG 机器人

**状态**：✅ 已修复
**文件**：`lib/bridge/telegram-adapter.js`
**修复**：启动时 `deleteWebhook` 清理 + token 有效性校验。

---

## 批次四：OAuth 代理与登录

### OpenAI Codex OAuth 登录失败（Token 交换 403）

**状态**：✅ 已修复
**文件**：`shared/hana-runtime-paths.cjs`, `node_modules/@mariozechner/pi-ai/dist/utils/oauth/openai-codex.js`
**问题**：OAuth 浏览器回调成功获取 code 后，服务端 `fetch()` 请求 `auth.openai.com/oauth/token` 因国内 IP 被 OpenAI 拒绝（403 unsupported_country_region_territory）。
**修复**：
1. `withHanaPiSdkEnv()` 自动检测 Clash for Windows 代理配置，注入 `HTTPS_PROXY` 环境变量
2. Pi SDK 的 token 交换 `fetch()` 使用 `undici.ProxyAgent` 经代理路由（非直连）
3. 验证结果：不加代理 → 403；加代理 → 401（无效 code，预期行为）

### #670 — dm 工具只能发送无法接收/查看回复

**状态**：📋 Feature 类

### #669 — dm 工具调用直接显示在对话框未实际执行

**状态**：🔍 待排查

### #671 — 私聊列表同一 Agent 重复显示

**状态**：✅ 已修复
**文件**：`server/routes/bridge.js`
**修复**：`/bridge/sessions` 端点对 DM 会话按 `platform:userId` 去重，同一用户多次接入只保留最后活跃的一条会话记录。

---

## 批次二：模型视觉能力声明

### #839 — 模型有视觉但程序说是文本模型

**状态**：✅ 已修复
**文件**：`server/routes/providers.js`
**修复**：
1. `normalizeRemoteModels()` 三个分支补全 `image` 字段透传（上游）
2. `_enrichOllamaVision()` 新增 — Ollama 模型发现时，通过启发式 pattern + `/api/tags` 检测视觉能力，覆盖 GGUF 量化模型

### #538 — kimi-for-coding 模型能力声明缺失

**状态**：⚠️ 已确认无需修复

### #594 — 模型发现自动识别多模态模型

**状态**：📋 待评估（Feature 类，暂缓）

---

## 批次三：记忆系统与工具调用稳定性

### #848 — 记忆文件被 `<think>` 标签污染

**状态**：✅ 已修复
**文件**：`core/llm-client.js`, `lib/memory/compiled-memory-state.js`, `lib/memory/session-summary.js`
**修复**：
1. `callText()` — `<think>`/`<thinking>` 正则增强，支持未闭合标签
2. `normalizeCompiledSectionBody()` — 记忆编译器输出统一剥离 think 标签
3. `rollingSummary()` — 会话滚动摘要输出后剥离 think 标签

### #855 — 空工具调用名 & 文本 XML 误解析为工具调用

**状态**：🔍 无法完全修复（依赖 Pi SDK 内部行为）
**分析**：
- **Bug 1（空工具名）**：`isToolCallBlock()` 在 `core/llm-utils.js:55` 已有 `!!b.name` 守卫，项目侧内容处理路径已覆盖。SDK 内部工具执行路径（`@mariozechner/pi-coding-agent`）不受项目侧过滤影响。
- **Bug 2（DSML 误解析）**：项目源码中不存在 `<invoke>`/DSML 解析逻辑，该解析在 Pi SDK 内部。无法从项目侧修复。

---

## 已修复（已收入 CHANGE_LOG.md）

| # | 标题 |
|---|------|
| #826 | Vision Bridge maxTokens 900→4096 |
| #811 | systemPrompt 时间戳实时替换 |
| #830 | mood_end 处理器缺失 |
| #815 | OAuth provider 模型删除端点 |
| #832 | useEffect 依赖稳定 |

---

## 本次改动汇总

| 文件 | 改动 |
|------|------|
| `server/routes/providers.js` | `normalizeRemoteModels` 三分支补 `image` + 新增 `_enrichOllamaVision` |
| `lib/bridge/bridge-manager.js` | `_appendPendingAttachments` 全类型预下载 |
| `lib/bridge/media-delivery-service.js` | `_sendSessionFile` buffer 失败 fallthrough 到 public_url |
| `lib/bridge/wechat-adapter.js` | `sendMediaBuffer` 中文报错简化 |
| `lib/bridge/feishu-adapter.js` | `sendMediaBuffer` image_key/file_key null 检查 |
| `core/llm-client.js` | `<think>`/`<thinking>` 正则增强，支持未闭合标签 |
| `lib/memory/compiled-memory-state.js` | `normalizeCompiledSectionBody` 添加 think 标签剥离 |
| `lib/memory/session-summary.js` | `rollingSummary` 输出后剥离 think 标签 |
| `lib/bridge/telegram-adapter.js` | 启动时 `deleteWebhook` 清理 + token 有效性校验（修复 #737） |
| `server/routes/bridge.js` | `/bridge/sessions` DM 会话按 userId 去重（修复 #671） |
| `BUG_FIXES.md` | 实时跟踪文档 |

*本文件由修复任务实时更新。*
