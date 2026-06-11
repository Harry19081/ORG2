# ORGII 死代码 + 重复实现审计（2026-06-11）

> 全局只读审计的结果。不动源码，分类登记。Phase 2 起按本目录的 findings 分阶段清理。
>
> **审计范围**：`src/`（前端 TS / React）+ `src-tauri/`（后端 Rust + Tauri 命令注册）。
> 跳过：`packages/`、`mobile-pwa/`、`build/`、`node_modules/`、`target/`、`gen/`、`Documentation/`。

## TL;DR

按"高 ROI、低风险、零行为变更"排序的 Top-5：

1. **后端 `IntegrationsConfig` 跨域**（embedding + excluded_skills + Smithery key + channels + databases 同一 struct）—— anti-pattern #31。修法：拆 3-4 个 struct。
2. **前端发送路径有 4 处 `dispatchMessageBySessionType` 调用**（`useWorkspaceChat.ts` 6 处、`useMessageDispatch.ts` 2 处、`useEditUserMessage.ts` 3 处、`next-step/index.tsx` 3 处）—— anti-pattern #21/#36/#53。修法：定单一 dispatcher，所有 UI 走 intent → 队列状态机。
3. **前端 14 个 `src/services/**Service.ts`无人使用的`export default`**（全部用 named import）—— 直接删 `export default` 关键字。
4. **后端 `ProviderConfig` 同名冲突**（`key-vault` 的 env-var 描述符 vs `agent-core` 的 LLM 连接参数，字段集完全不交叉）—— anti-pattern #30。修法：重命名为 `KeyVaultProviderConfig` + `LlmConnectionConfig`。
5. **后端 `ConflictResolution` 同名冲突且同 crate**（`sync/adapter.rs` 的 resolver 决策 vs `sync/conflict_log.rs` 的用户 UI 选择）—— anti-pattern #30。修法：`AdapterResolverVerdict` + `UserConflictChoice`。

## Baseline 漂移

**memory `workspace_dead_code_scan_landscape.md`（写于 2026-06-08）已部分过期**。本次现场 ripgrep 复核：

| memory 中候选模块                                          | 现状                                                      | 复核结论                                    |
| ---------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| `src/util/monitoring/apiTracker.ts` + `apiTrackerUtils.ts` | 文件已不存在                                              | `[stale → closed]`                          |
| `src/util/core/storage/localStorage.ts`                    | 被 `src/app/root/useAppDeferredInitialization.ts:26` 引用 | `[stale → ALIVE]` 不可删                    |
| `src/util/core/init/deferredInit.ts`                       | 被 `src/app/root/useFirstPaintSignal.ts:21` 引用          | `[stale → ALIVE]` 不可删                    |
| `src/util/platform/tauri/gitBundle.ts`                     | 0 引用（三 pattern 均未命中）                             | `[confirmed dead]` 可删                     |
| `src/util/dialogs/gitActionDialog.ts`                      | 12 处引用                                                 | `[stale → ALIVE]` 不可删                    |
| `src/util/dialogs/channelActionDialog.ts`                  | 1 处引用                                                  | `[stale → ALIVE]` 不可删                    |
| `src/util/dialogs/gitAuthenticationDialog.tsx`             | 1 处引用                                                  | `[stale → ALIVE]` 不可删                    |
| `src/util/dialogs/openLinkDialog.ts`                       | 0 引用                                                    | `[confirmed dead]` 可删                     |
| ~14 个 `src/services/**` 未使用 `export default`           | 全部 14 个仍然成立（无 `import X from`）                  | `[confirmed]` 删 `default` 关键字保留 named |

**memory `workspace_force_send_queue_dispatch.md`（2026-06-10）也部分过期**：

- 说"`holdSessionQueueForStopAtom` / `forceSendPendingQueueAtom` / `markQueueTurnSettled` 已 GONE"——错。实际：
  - `holdSessionQueueForStopAtom` 仍然存在于 `src/store/ui/messageQueueAtom.ts:164`、`sessionTimelineBoundary.ts:20/132`、测试 4 处引用。这是 anti-pattern #51 描述的 "shadow boolean shadowing FSM phase"。
  - `forceSendPendingQueueAtom` 现在只剩 e2e helper `inspectChatState.ts:147` 引用——确实从生产路径删干净了。
  - `userInitiatedCancelAtom` 同时活在 `cliSessionStatusAtom.ts` / `sessionTimelineBoundary.ts` / `useQueueDispatch.ts` 多处——anti-pattern #54 ("multi-purpose cancel atom") 尚未拆。

## 执行状态（2026-06-11 21:30 更新）

### ✅ 已完成

- **Phase 1** — Audit 报告落档（本目录 4 个 markdown）
- **Phase 2** — 零风险删除
  - 删 `src/util/platform/tauri/gitBundle.ts`（0 引用确认）
  - 删 `src/util/dialogs/openLinkDialog.ts`（0 引用确认）
  - 删 14 个 `src/services/**Service.ts` 的 `export default` 关键字（保留 named 导出；所有调用方都是 named import）
  - **验收**：`pnpm tsc --noEmit` 错误数 109（与 Phase 1 baseline 一致，全是历史 `LegacyRef` 错，未引入新错）
- **Phase 3** — ChatPanel engine 搬家
  - 8 个文件用 `git mv` 搬到 `src/engines/ChatPanel/panels/`：ProjectPanelView / WorkItemPanelView / Workspace{Dashboard,Explore,Overview}PanelView / BenchmarkRunBuilder / LinkSessionToWorkItemModal / useBenchmarkSessionCreatorSlots
  - 更新 ChatPanelContent.tsx（5 处）+ ChatPanelEmptyContent.tsx + index.tsx + hooks/useChatPanelSessionModals.tsx + panels/WorkItemPanelView.tsx（`./ChatView` → `../ChatView`）的 import 路径
  - **验收**：`pnpm tsc --noEmit` 错误数仍 109，未引入新错
- **Phase 4** — 后端 dead code 重新评估
  - `src/api/agent/mod.rs:14/21/26` 的 3 个 `#[tauri::command]` 实际是 `#[cfg(not(debug_assertions))]` release 桩，被 e2e helpers (`projects.ts:240/287`) 调用 —— **不是死命令**。但 `handler_list.inc` 未注册 release 桩，意味着 release build 走到这里会拿 "command not found" 而不是 "only in debug build" 错误信息 —— 这是 release/debug 行为不一致的潜在 bug，列入 follow-up 而非清理目标
  - `cursor-bridge/src/models.rs:257/258` 两个 `.expect("string serializes")` —— JSON 字符串序列化永远不失败，是 defensive code，**保留**
  - **本 Phase 无源码改动**

### ⛔ 已停下：Phase 5-8 需要先做现状 e2e（不能盲推）

**理由**：这 4 个 Phase 都是真正语义/wire 变更，且 memory 已经多次警告"删错了会让 Stop 后第一条消息掉"/"改背景路径需要 e2e 验证"。在没有先跑现状 queue + send + reflection e2e 的情况下盲推会破坏现状，违反"零行为变更"红线。

| Phase                                       | 变更性质                                            | 必须先做的事                                                                                       |
| ------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Phase 5 拆 `IntegrationsConfig`             | wire JSON shape 改 + migration 函数                 | 跑现状 reflection + active_learning + consolidation e2e；定义 migration 策略（覆盖式 vs 多源回退） |
| Phase 5 `skills_lookup` helper              | CLI session runner 不再要求 sde `selected_model_id` | 跑现状 sde session launch e2e（含 skills 解析路径）                                                |
| Phase 6 `ProviderConfig` × 2 拆名           | 前端 Zod schema 跟进                                | grep 前端所有 `invoke()` 调用 ProviderConfig 相关命令的位置；同 PR 内更新 Zod                      |
| Phase 6 `ConflictResolution` × 2 拆名       | sync wire 协议字段重命名                            | 跑现状 sync conflict resolve e2e                                                                   |
| Phase 6 `TantivyIndexInfo` 字段类型对齐     | wire schema u64 vs usize                            | 跑现状 semantic search e2e（feature flag on / off 各跑一遍）                                       |
| Phase 7 删 `holdSessionQueueForStopAtom`    | queue dispatch 语义                                 | 跑现状 messageQueueAtom.test.ts + manual Stop → 立即重发 1 条 e2e                                  |
| Phase 7 拆 `userInitiatedCancelAtom`        | post-Stop 调度 + draft 恢复语义双拆                 | 同上 + draft 恢复手动验证                                                                          |
| Phase 8 统一 `dispatchMessageBySessionType` | 14 处调用集中到 1 处                                | 跑 next-step / edit-user-message / useWorkspaceChat 各自的现状 e2e                                 |

**Action**：用户先确认想要哪种节奏（一次性大 PR / 每 Phase 单 PR + e2e）+ 是否愿意为 Phase 5-8 单独 spawn 计划。本 audit 把所有 finding + 推荐做法 + 风险都列在 4 个 markdown 里，可随时按 Phase 单独拉起。

### 通用

- [ ] `pnpm tsc --noEmit` 0 错（每个 Phase 结束验）。
- [ ] 各受影响 crate `cargo check -p <crate_underscore_name>` 0 错。
- [ ] 删除/重命名前必须三 pattern ripgrep 确认零引用：`from ['"].*<basename>['"]`、`import\(.*<basename>`、`['"].*\/<basename>['"]`，且搜过 `*.rs` / `tests/` / `scripts/` / `mobile-pwa/`。
- [ ] 无新文件创建，除非是 audit 报告 / 拆分后的目标 struct 所在文件。

### Phase 2（前端 dead code）

- [ ] 删除 `src/util/platform/tauri/gitBundle.ts`、`src/util/dialogs/openLinkDialog.ts`。
- [ ] 删除 14 个 `src/services/**Service.ts` 的 `export default` 关键字（保留所有 named 导出）。
- [ ] `pnpm check:unused-exports` 模块数 < 862。

### Phase 3（ChatPanel engine 搬家）

- [ ] `src/engines/ChatPanel/` 根下只剩 chat 文件（见 `frontend-findings.md` §3）。
- [ ] 用 `git mv` 操作，每次搬一个 PanelView + 全 import 路径同 PR 更新。

### Phase 4（后端 dead code）

- [ ] 删除 `cursor-bridge/src/routing.rs:61` 旁边的死字符串序列化 `.expect`（如果确认是死路径）。
- [ ] `src/api/agent/mod.rs:14/21/26` 3 个 `#[tauri::command]` 验证是否未注册 → 若是死命令则删除。
- [ ] `cursor-bridge/src/models.rs:257/258` 两个未验证的 `.expect()` 抽样确认。

### Phase 5（后端 config 拆域 + resolver 脱钩）

- [ ] `IntegrationsConfig` 拆为 `EmbeddingConfig`（global）+ `ExcludedSkillsConfig`（global）+ `McpSmitheryConfig`（key-vault）+ `ChannelsConfig` + `DatabasesConfig`，保留 `IntegrationsConfig` 作为 facade（migration 写入新 JSON 字段）。
- [ ] `src/agent_sessions/cli/session_runner/session.rs:1680` 的 `resolve_sde_skills` 改用新建的 `skills_lookup::resolve_skills_for(agent_id)`，不再走完整 `ResolvedAgent::resolve()`。
- [ ] grep `ResolvedAgent::resolve` 后只剩前台 session-startup 路径 + 测试。

### Phase 6（同名冲突重命名）

- [ ] `ProviderConfig` 拆成 `KeyVaultProviderConfig` + `LlmConnectionConfig`。
- [ ] `ConflictResolution` 拆成 `AdapterResolverVerdict` + `UserConflictChoice`。
- [ ] `TantivyIndexInfo` 在 stubs vs real 间字段统一（`index_size_bytes` 类型一致 `u64`）。

### Phase 7（队列/取消语义清理 — Anti-pattern #51/#54）

- [ ] 删除 `holdSessionQueueForStopAtom`，让 FSM `stopping` phase 取代。
- [ ] 把 `userInitiatedCancelAtom` 拆成 `postStopDispatchEpisodeAtom`（intent）+ `stopDraftRestorationPendingAtom`（draft window），每个 atom 单一 writer。

### Phase 8（发送路径统一 — Anti-pattern #21/#36/#53）

- [ ] 全部 UI 组件停止直接调 `dispatchMessageBySessionType`；所有发送都经过 `useMessageDispatch` 单一 dispatcher。
- [ ] grep `dispatchMessageBySessionType` 后只剩 `useMessageDispatch.ts` 一个文件。

## 文件索引

- [`frontend-findings.md`](./frontend-findings.md) — 前端（TS / React / atoms）的死代码 + 重复实现
- [`backend-findings.md`](./backend-findings.md) — 后端（Rust / Tauri 命令）的死代码 + 重复实现
- [`cross-layer-findings.md`](./cross-layer-findings.md) — 跨层重复（前后端都在做的事）

## 不在范围

- 不动 `src/hooks/workStation/browser/useOpenUrlInBrowser.ts` 和 `src/modules/WorkStation/.../DomComponentPreviewContent/index.tsx`（用户其它在飞 dirty 工作）。
- 不动 `packages/`、`mobile-pwa/`（不在桌面构建里，见 memory `workspace_packages_and_mobile_split.md`）。
- 不动 `Documentation/Shared/cla-process--0602.md`（Rust 字符串字面量引用）。
- 不引入 `knip` / `madge` / `depcheck`（仓库未装）。
- 不删 `build/`（已 `.gitignore`）。

## 审计置信度

| 维度                           | 置信度   | 备注                                                 |
| ------------------------------ | -------- | ---------------------------------------------------- |
| 前端 dead module / dead export | 高       | 三 pattern ripgrep 全过                              |
| 前端 ChatPanel engine 错放     | 高       | 现场 `list_dir` 直接列出                             |
| 前端发送路径重复               | 高       | grep 命中 14 处                                      |
| 前端多源真相 atom              | 高       | grep 命中 + 文件路径全列                             |
| 前端 tab 系统残余重复          | **低**   | 本次审计未完成（前端 subagent 中断），列入 follow-up |
| 前端空目录 / 一文件目录        | **未跑** | 列入 follow-up                                       |
| 后端 Tauri command 矩阵        | 中       | 抽样验证，未跑全 1149 条                             |
| 后端同名 struct/enum           | 高       | 3 处真冲突已 grep + 字段对照                         |
| 后端 Config 跨域               | 高       | 单文件深读验证                                       |
| 后端 `.expect()` on fallback   | 高       | 几乎全部在 `#[cfg(test)]`                            |
| 后端 Wire protocol bloat       | 高       | 未发现                                               |
| 后端 Init parity               | 中       | 抽样 7 个入口，未跑全                                |
| 后端 Resolver 不对称           | **低**   | identity.rs 未深读                                   |
| 后端 backward-compat shim      | 中       | 抽样                                                 |
