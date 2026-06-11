# 后端死代码 + 重复实现 findings（Rust / Tauri）

> 范围：`src-tauri/src/` + `src-tauri/crates/*`。后端 explore subagent 完整跑完 14 维度并交付。下面是经主上下文交叉验证后的整理版本。

## TL;DR

- 3 处真正同名冲突（`ProviderConfig` / `ConflictResolution` enum / `TantivyIndexInfo` 字段宽度）
- 1 处生产路径 `ResolvedAgent::resolve()` 误用（CLI session runner 仅为读 `.skills`）
- 1 处严重 config 跨域（`IntegrationsConfig` 把 embedding + excluded_skills + Smithery key + channels + databases 装一个 struct）
- 1 处 init parity 半隔断（`channel_handler/dispatch.rs:253` 只 `register_session` 不 `ensure_session_initialized`）
- **`.expect()` on fallback path 实际守得不错**（几乎全部在 `#[cfg(test)]` 或字符串序列化无失败路径）
- **无 wire-protocol bloat**（schemars 只用于 LLM tool params，不跨 IPC）

## 1. Tauri command 注册矩阵

- `src-tauri/src/commands/handler_list.inc` 共 **~915** 条注册（1149 行 - 注释/空行）。
- 抽样验证 `#[tauri::command]` 总声明 **>250**。

**注册→实现 抽样确认全部命中**（debug_seed_learning / debug_memory_prefetch_section / session debug 8 个 / advanced_search 22 个 / session_trigger_reflection）。

**fn 存在但未注册（潜在死命令）—— 需 follow-up 验证**：

| fn 位置                                                      | 风险                                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `agent-core/src/foundation/utils/shell_commands.rs:14, 25`   | 注册路径 `agent_core::utils::shell_commands::*`，模块名不一致（`utils` vs `foundation::utils`）—— 走 re-export 链？ |
| `agent-core/src/foundation/persistence/db_helpers/mod.rs:41` | 整个文件未在 `handler_list.inc` 出现 —— ⚠️ 可疑死命令                                                               |
| `src/api/agent/mod.rs:14, 21, 26` 3 个 `#[tauri::command]`   | handler*list 只看到 `api::agent::test::core::debug*\*` 系列，不见 mod.rs 顶层 —— ⚠️ 可疑死命令                      |

**已声明退役（符合预期）**：`start_kiro_sso_login` / `cancel_kiro_sso_login` 在 `.archive/`；`builtin_simulator_app_map` / `cli_tool_alias_map` 被 `init_tool_registry` 取代。

## 2. 跨模块同名 struct / enum

| 名字                                                                                          | 出现位置                                                                                                                                                                                                                                                         | 字段集合                                                                                                                                                                                                             | 严重度                                                                                                   |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **`ProviderConfig`**                                                                          | `key-vault/src/provider_config.rs:12`（`api_key_env_var`/`base_url_env_var`/`supports_base_url`/`default_base_url` — 前端 env-var 描述符）vs `agent-core/src/core/providers/traits.rs:360`（`api_key`/`api_base`/`extra_headers`/`is_azure` — runtime 连接参数） | 完全不交叉                                                                                                                                                                                                           | 🚩 真冲突，都过 Serde；建议 `KeyVaultProviderConfig` + `LlmConnectionConfig`                             |
| **`ConflictResolution` enum**                                                                 | `sync/adapter.rs:147`（`KeepLocal/UseRemote/Merge` — resolver 决策）vs `sync/conflict_log.rs:125`（`UseLocal/UseRemote/Dismissed` — 用户 UI 选择）                                                                                                               | 不同 variant 集，都过 Serde `rename_all="snake_case"`                                                                                                                                                                | 🚩 真冲突且同 crate；建议 `AdapterResolverVerdict` + `UserConflictChoice`                                |
| `TantivyIndexStats` / `TantivyIndexInfo` / `SearchHit` / `MatchingLine` / `IncrementalResult` | `advanced-search/src/commands/stubs.rs:21-72` vs `advanced-search/src/tantivy_index.rs:654-692`                                                                                                                                                                  | stubs 的 `TantivyIndexStats { files_indexed, total_bytes, duration_ms }` vs real 的 `{ files_indexed, files_failed, total_files, languages }`；`TantivyIndexInfo.index_size_bytes` 类型 `u64`(stub) vs `usize`(real) | ⚠️ feature flag `semantic-search` 互斥，但 wire 形状不一致；frontend Zod 在 release/debug 间 schema 不同 |
| `McpServerConfig`                                                                             | `agent-core/src/specialization/mcp/config.rs:23`                                                                                                                                                                                                                 | 单一定义被 ~10 处 `use` 传递                                                                                                                                                                                         | ✅ 非冲突                                                                                                |

**`Manager` / `State` / `Handler` 后缀**：抽样未发现真冲突（`McpManager`/`LspManager`/`RepoWatchManager`/`SessionStoreManager`/`PlanApprovalManager`/`ModeSwitchManager`/`QuestionManager`/`AgentPermissionManager`/`DebounceManager`/`IndexManager` 各自唯一）。

## 3. Config 结构跨域

| Config                        | 文件:行                                             | 跨域评估                                                                                                                                                                                                                                              |
| ----------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`IntegrationsConfig`**      | `agent-core/src/integrations/config.rs:75`          | 🚩 严重：`channels` + `databases` + `nodes` + `web_search` + `mcp(Smithery key)` + `embedding`(语义索引) + `excluded_skills`(技能黑名单)。注释自承（:108-109）："globally excluded skills"被塞这里"to keep existing files readable without migration" |
| `SmitheryConfig`              | `integrations/config.rs:185`                        | 单字段 `smithery_api_key`，本质是 secret —— 建议挪到 key-vault                                                                                                                                                                                        |
| `IntegrationConfig`（非复数） | `terminal/src/pty_commands/shell_integration.rs:22` | 命名易混淆，但语义无关（shell prompt 集成）                                                                                                                                                                                                           |
| `AgentLearningsConfig`        | `core/definitions/schema.rs:541`                    | ✅ 单域                                                                                                                                                                                                                                               |
| `EmbeddingConfig`             | `integrations/config.rs:222`                        | ✅ 单域，但嵌在 `IntegrationsConfig` 内                                                                                                                                                                                                               |

**`ChannelsConfig`**（`integrations/channels/config/mod.rs:93`）内嵌 16 个 platform-specific config（Slack/Email/Teams/Matrix/GoogleChat/Feishu/DingTalk/Zalo/WeCom/Weixin/Line/Telegram/Discord/WhatsApp/Signal/iMessage 各一对 `*AccountConfig` + `*Config`）—— 类型爆炸，应该 trait + Vec 或 untagged enum。

## 4. 背景子系统误调 `ResolvedAgent::resolve()`

`ResolvedAgent::resolve` 共 ~40 处调用。生产背景路径分析：

| 位置                                                                                                    | 评估                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `memory/reflection/mod.rs:92, 94`                                                                       | ✅ 已修：注释明示用 `resolve_learnings_for` 替代，实际调 `learnings_lookup::resolve_learnings_for(def_id)` (:101)                                                             |
| `memory/reflection/active_learning/mod.rs:78, 80`                                                       | ✅ 已修：同上模式 (:83)                                                                                                                                                       |
| `state/session_runtime.rs:65`                                                                           | ✅ 合规：launch 期一次性                                                                                                                                                      |
| `init/{mod.rs:92, 165}`, `launch_spec.rs:245`, `runtime_assemble.rs:63`, `agent_definition_loader.rs:9` | ✅ launch 主干                                                                                                                                                                |
| **`src/agent_sessions/cli/session_runner/session.rs:1680` `resolve_sde_skills()`**                      | 🚩 anti-pattern #27：仅为读 `resolved.skills` 就 resolve 整个 sde definition。和 reflection 已修复模式同形。应建 `resolve_skills_for(agent_id) -> SkillsParams` lookup helper |
| `src/api/agent/dto.rs:89, 342` / `public.rs:75, 93, 97`                                                 | ✅ 已有 `AgentRuntimeView::from_definition` 降级路径                                                                                                                          |

## 5. 僵尸类型（Layer 2 call-chain trace）

| 类型                                                                                                                                             | 评估                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AgentLearningsView` / `EmbeddingView` / `CompactionView` / `ToolSelectionView` / `SkillsView` / `IntegrationsView` (`api/agent/dto.rs:190-299`) | ⚠️ 半僵尸：业务路径只通过外层 `AgentRuntimeView`；`dto_extended_tests.rs` 反复构造测试（~40 次 `agent_runtime_view` 来自 \_tests）。建议合并 `pub(super)`，减少冗余 `From` impl |
| `UnifiedSession` (`crud/record.rs:37`)                                                                                                           | ✅ ~30+ 个生产位置                                                                                                                                                              |
| `SessionFilter` (`unified_stats/types.rs:204`)                                                                                                   | ⚠️ 7 处调用，生产 1-2 处 —— 半僵尸                                                                                                                                              |

## 6. Relay struct（anti-pattern #25）

| Relay struct                                                  | 证据                                                                              | 修法                         |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------- |
| `benchmark.rs:71-200` 11 个 `Benchmark*Request`               | `BenchmarkGetRunStatusRequest:120` + `BenchmarkCancelRunRequest:126` 字段几乎全等 | 合并 `BenchmarkRunIdRequest` |
| `LinearProjectCreateRequest:172` / `*UpdateRequest:187`       | Create/Update 字段重叠                                                            | builder / partial-update     |
| `LinearWorkflowStateCreateRequest:201` / `*UpdateRequest:215` | 同                                                                                | 同                           |
| `LinearIssueCreateRequest:229` / `*UpdateRequest:244`         | 同                                                                                | 同                           |
| `spreadsheet_xlsx.rs:11, 31, 61` 各 `*Request`                | 都以 `path: String` 开头                                                          | 跨 command 重复 path         |
| `spreadsheet_csv.rs:12, 37`                                   | 同                                                                                | 同                           |

## 7. `.expect()` on fallback path（anti-pattern #33）

**绝大多数命中在 `#[cfg(test)]`**：

| 位置                                                                                                | 性质                                           |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `webhook_secrets.rs:163-245`（19 次）                                                               | 全在 `mod tests` (:158)                        |
| `webhook_listener.rs:426-610`（21 次）                                                              | 全在 tests (:420)                              |
| `org_tasks.rs:1051-1165`（7 次）                                                                    | tests fixtures (:1136)                         |
| `desktop.rs:254-277`（4 次）                                                                        | tests (:248)                                   |
| `inbox_drain/mod.rs:55-65`（4 次）                                                                  | tests (:54)                                    |
| **`cursor-bridge/src/routing.rs:61`** `serde_json::to_string(agent_id).expect("string serializes")` | 生产代码，字符串序列化无失败路径 —— 实质低风险 |
| `cursor-bridge/src/models.rs:257, 258`                                                              | ⚠️ 需进一步抽样确认                            |

**未发现 `unwrap_or_else(...).expect(...)` 链式 fallback 误用**（grep 0 命中）。

## 8. Wire protocol bloat（Layer 8）

`schemars` / `SchemaSettings` / `into_root_schema` 出现位置：

- `agent-core/src/core/tools/params.rs:69-86`：构造 JSON Schema **只服务 LLM tool params**（function calling 签名）
- 其余 `schemars` 都是 tool param 派生（`#[derive(JsonSchema)]`）

**未发现 wire payload 用 `schemars` 派生** —— IPC 命令用普通 serde。**无 wire-protocol bloat**。

## 9. Init parity（Layer 9）

`ensure_session_initialized` / `register_session` 调用矩阵：

| 入口                                  | `register_session`        | `ensure_session_initialized`           |
| ------------------------------------- | ------------------------- | -------------------------------------- |
| Tauri `session_launch`                | ✅ via `lifecycle.rs:435` | ✅ via `init/mod.rs:98, 188, 205, 286` |
| Tauri `agent_send_message`            | (后续)                    | ✅ `:159`                              |
| Tauri `agent_question_response`       | ✅ `:313`                 | ✅ `:221, 308`                         |
| HTTP `api::agent::public.rs:48`       | (不调)                    | ✅ `:48`                               |
| HTTP/test `test/sde.rs:267, 692, 915` | ✅                        | ❌（测试白盒可接受）                   |
| HTTP/test `test/core.rs:121, 756`     | ✅                        | ❌                                     |
| **`channel_handler/dispatch.rs:253`** | ✅                        | ❌                                     |

🚩 `channel_handler/dispatch.rs:253`：channel webhook 入口只 `register_session`，不调 `ensure_session_initialized`。是否真漏 init 取决于 `register_session` 自身是否 self-chain —— 需读 `lifecycle.rs:435` 验证。

## 10. Resolver 不对称（Layer 10）

**[partial]** `state/commands/session/identity.rs:62` 多字段 resolver 字段级 fallback 对称性未深查；`core/definitions/resolved.rs:226-617` 已被 `resolve_learnings_for` / `from_definition` 显式拆出。建议 follow-up 跑 identity.rs 全文。

## 11. DEPRECATED 项

抽样 ~30 处命中，**绝大多数误报**：

- `memory/learnings/lifecycle.rs:99-266`（13 次）—— `"deprecated"` 是 learnings DB column `status` 的 enum 值
- `memory/consolidation/events.rs:33, 197` —— mem0 状态机术语
- 其余 ~10 处都是注释

🚩 **整个仓库无 `#[deprecated]` 属性**（grep 0 命中）—— ROI 偏低。

## 12. Backward-compat shim

| 位置                                                                                        | 性质                                                                                      |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `integrations/config.rs:29-35, 108-110, 180` "Violent migration" + `disabled_skills` rename | ✅ 已清完的 shim（注释明示"No migration function"），但 `disabled_skills` JSON key 仍保留 |
| `integrations/patch.rs:35, 84` "compat" "legacy"                                            | 需抽样验证                                                                                |
| `state/commands/session/debug/{prompt.rs:160, general.rs:74, 140}` "legacy"                 | 调试命令                                                                                  |
| `memory/consolidation/decision.rs:20` "compat"                                              | mem0 外部协议兼容（保留合理）                                                             |
| `foundation/persistence/session_snapshots.rs:31, 129-242`                                   | DB schema 迁移序列（无法 violent migrate）                                                |

生产 shim 几乎清除完毕。

## 13. 命名语义重叠（同名 enum variant 多义）

- **`ConflictResolution`** —— 见 §2，最大风险
- **`Local` / `Remote`** —— `AppliedSide` (`conflict_log.rs:116`) 用 `Local/Remote`，两个 `ConflictResolution` 一个 `KeepLocal`、一个 `UseLocal`、都 `UseRemote` —— ⚠️ 同 crate `sync/` 模块内可读性风险
- **`Gateway`** / **`State`** / **`Provider`** / **`Context`** / **`Manager`** —— 抽样后定义唯一

## 14. 其他偶然发现

- `#[allow(dead_code)]` 共 **18 处**，主要在 `key-vault/src/providers/{kiro,copilot,cursor/quota}/`、`advanced-search/src/embedders/`、`project-management/src/sync/oauth/linear.rs:416, 419`、`ui-indexer/src/parser/mod.rs:46, 51` —— 隐藏死代码最大窗口
- `AgentRuntimeView::from_definition` (`dto.rs:96`) —— 显式 fallback 范式，给出 anti-pattern #33 可推广修法
- `cursor-bridge/src/models.rs:257, 258` 2 个 `.expect(` 上下文未确认
- `integrations/patch.rs:35, 84` "compat" / "legacy" 是否为活 shim 未深查

## OPEN questions

1. **`ProviderConfig` 冲突**：重命名（`KeyVaultProviderConfig` + `LlmConnectionConfig`）还是合并到一个 crate？字段集完全不交叉 —— 倾向重命名。
2. **`ConflictResolution` 双 enum**：domain 不同（resolver 决策 vs 用户 UI 选择），合并 superset 还是显式区分 `ResolverVerdict` + `UserConflictChoice`？
3. **`IntegrationsConfig` 拆分**：代码注释里有"to keep existing files readable without migration"的隐含承诺，拆分需写 migration。是否接受短期 migration 成本？
4. **`api/agent/mod.rs:14, 21, 26` 三个 `#[tauri::command]` 是否真死命令**？需 follow-up 深查 handler_list.inc 全 1149 行。
5. **`session.rs:1680 resolve_sde_skills` 是否按 `learnings_lookup.rs` 范式新建 `skills_lookup::resolve_skills_for(agent_id)`**？
6. **`channel_handler/dispatch.rs:253` 的 init parity** 是否真漏？需读 `lifecycle.rs:435` 的 register_session 实现确认是否 self-chain。
7. **`#[allow(dead_code)]` 18 处** 是否要 follow-up 挨个 review？
8. **`stubs` vs real `TantivyIndexInfo.index_size_bytes: u64` vs `usize`** 是否需要严格对齐？64-bit 平台无差，但 wire schema 不一致。
9. **`sync` 模块的 `Local` / `Remote` 命名混乱** 是否需要统一前缀（`Keep*` / `Use*` 二选一）？
10. **`ChannelsConfig` 16 个 inline platform configs** 是否值得改成 `Vec<Box<dyn ChannelAdapter>>` 或 `HashMap<ChannelKind, serde_json::Value>` 的多态结构？

---

**审计范围声明**：覆盖 `src-tauri/src/` + `src-tauri/crates/*/src/`，跳过 `target/` + `gen/`。grep pattern 已跑：`#\[tauri::command\]` / `^pub struct \w+` / `^pub enum \w+` / `ResolvedAgent::resolve` / `unwrap_or_else.*expect` / `\.expect\(` / `schemars` / `SchemaSettings` / `ensure_session_initialized` / `register_session` / `compat|legacy|backward|migration|shim` / `DEPRECATED|deprecated` / `ALTER TABLE` / `#\[allow\(dead_code\)\]` 等。**未跑** `cargo check` / `cargo clippy`（按计划）。
