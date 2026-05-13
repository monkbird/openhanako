# 稳定性加固变更日志

> 日期：2026-05-12
> 范围：7 个核心模块稳定性加固 + 5 个 issue 修复

---

## 5/12 最新批次修复（5 个 issue）

| Issue | 文件 | 修复内容 |
|-------|------|---------|
| #826 | `core/vision-bridge.js` | Vision Bridge maxTokens 900 → 4096，兼容推理模型 |
| #811 | `core/session-coordinator.js` | systemPrompt 时间戳改为每次调用实时替换，不再用缓存快照 |
| #830 | `server/routes/chat.js` | mood_end 处理器缺失导致 mood 流中断 |
| #815 | `desktop/.../ProviderModelList.tsx` | OAuth provider 模型删除走正确端点 |
| #832 | `desktop/.../useBridgeState.ts` | useEffect 依赖稳定 + loadStatus 用 useCallback 包装 |

---

## 稳定性加固（7 个核心模块）

### 1. `core/migrations.js` — 迁移失败不阻塞后续

| 问题 | 改动 |
|------|------|
| 单条迁移 `break` 阻断所有后续迁移 | `break` → `continue`，失败迁移下次启动重试 |
| 版本号在迁移失败时也被写入 | `_dataVersion` 持久化移入 `try` 内部，失败不写入 |
| 缺乏幂等契约文档 | 添加迁移实现契约 JSDoc（幂等性、原子性、无副作用） |

## 2. `core/agent.js` — 记忆系统可靠性

| 问题 | 改动 |
|------|------|
| v1→v2 迁移失败写 sentinel 标记，永久放弃重试 | 迁移失败不写标记，下次启动自动重试 |
| 模型未配置时 ticker 不创建，后续设模型后也无法激活 | 提取 `_initMemoryTicker()` 方法，`setMemoryModel()` 从 null→非 null 时自动创建 ticker |
| 初始模型 resolve 探针无重试，网络抖动导致误告警 | 加一次 2s 重试后再告警 |

## 3. `core/llm-utils.js` — LLM 调用统一重试

| 问题 | 改动 |
|------|------|
| 6 个 LLM 调用点全部无重试，临时网络故障导致永久失败 | 添加 `_isRetryableError()` + `_withRetry(fn, opts)` 辅助函数 |
| | 4× `callLlm` + 2× `callText` 统一改为 3 次指数退避重试（1s/2s/4s） |
| | 超时/AbortError/4xx 不重试，5xx/429/网络错误重试 |

## 4. `core/bridge-session-manager.js` — Session 管理

| 问题 | 改动 |
|------|------|
| `abortSession` 在 cleanup 前删除 map 条目，泄漏 session | delete 移到最后，先 abort 再 dispose 再删除 |
| `abortSession` 永远返回 `true`，调用方无法感知失败 | 返回 `cleanupOk` 反映实际结果 |
| `injectMessage` 中 `_resolveAgent` 在 try/catch 外，抛错不统一 | 移入 try/catch 内 |
| `injectMessage` 文件不存在时不清理索引，后续仍会失败 | 清理索引条目 + 写回 |
| `injectMessage` 使用后不释放 SessionManager 句柄 | 添加 `finally { mgr.dispose?.() }` |
| `reconcile` 单 agent 损坏阻断所有 agent 清理 | 每个 agent 包 try/catch |
| 缺乏全局关闭入口，活跃 session 无法优雅终止 | 添加 `dispose()` 方法 |

## 5. `core/agent-manager.js` — Agent 初始化失败路径

| 问题 | 改动 |
|------|------|
| 焦点 agent `init()` + `loadConfigOnly()` 双失败时仍注册（null config → NPE） | `_registerAgent` 移入 `loadConfigOnly` try 内部，双失败不注册 |
| 非焦点 agent init 失败后静默消失，UI 无法感知 | 注册骨架 agent + `_initError` 标记 |
| `switchAgent` `models.chat` 缺 provider 时静默继承上 agent 模型 | 显式 `defaultModel = null` + 发射 devLog |
| 频道清理失败后 agent 目录仍被删除，无法恢复 | 抛错阻止目录删除 |

## 6. `core/engine.js` — 模型同步失败日志

| 问题 | 改动 |
|------|------|
| `syncModelsAndRefresh()` 错误被空 `catch {}` 吞没 | 改为记录 warn + error 日志 |

## 7. `core/session-coordinator.js` — 高频变更区加固

| 问题 | 改动 |
|------|------|
| `switchSession` 并发调用导致状态不一致 | 添加 `_switchQueue` 串行化队列 |
| 4+ 处重复的 `session-meta.json` 读取 try/catch 模式 | 提取 `_getSessionMetaEntry()` 辅助方法，`_doSwitchSession` 和 `createSession` 两处使用 |

---

---

## 5/13 批次修复 — OpenAI Codex OAuth 代理支持

| 文件 | 修复内容 |
|------|---------|
| `shared/hana-runtime-paths.cjs` | 自动检测 Clash for Windows 代理（读取 `config.yaml` 的 `mixed-port`），注入 `HTTPS_PROXY` 环境变量传递给 Pi SDK |
| `node_modules/@mariozechner/pi-ai/dist/utils/oauth/openai-codex.js` | token 交换 `fetch()` 使用 `undici.ProxyAgent` 经代理路由，解决国内无法直连 OpenAI token 端点（403）的问题 |

### 问题
OpenAI Codex OAuth 浏览器回调成功后，token 交换请求从服务器 Node.js 直连 `auth.openai.com/oauth/token`，因国内 IP 被 OpenAI 拒绝（403 unsupported_country_region_territory）。

### 修复
1. `detectProxyEnv()` 在 `withHanaPiSdkEnv()` 中自动检测本地 Clash for Windows 代理配置，注入 `HTTPS_PROXY` 环境变量
2. Pi SDK 的 `exchangeAuthorizationCode()` 和 `refreshAccessToken()` 读取 `HTTPS_PROXY`，使用 `undici.ProxyAgent` 将 token 请求路由通过 Clash 代理发出
3. 验证：不加代理 → 403；加代理 → 401（无效 code，预期行为）

## 改动量统计

| 文件 | 新增行 | 删除行 |
|------|--------|--------|
| core/agent.js | 75 | 42 |
| core/bridge-session-manager.js | 55 | 38 |
| core/session-coordinator.js | 35 | 26 |
| core/llm-utils.js | 46 | 8 |
| core/agent-manager.js | 21 | 1 |
| core/migrations.js | 12 | 7 |
| core/engine.js | 6 | 1 |
| **合计** | **250** | **122** |

---

*本文件由稳定性加固任务自动生成。*
