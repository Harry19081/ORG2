# 跨层重复 findings（前后端协同）

> 跨层重复：前端和后端各自实现同一概念、或共享硬编码字面量却没有 canonical 源。

## 1. AgentExecMode 字符串：picker 子集 vs wire union

memory `workspace_agent_exec_mode_display_wire_split.md` 已记录：

- 前端 picker `AGENT_EXEC_MODES`（build/plan/investigate-as-"Ask"）只有 3 个。
- 前端 wire union `ALL_AGENT_EXEC_MODES` 仍含 debug / review / wingman 等 legacy。
- 后端 enum 在 `src-tauri/crates/agent-core/src/core/...`（具体未定位）。

**风险**：前端 UI 不可达到的 mode 仍可能在 wire 上漂浮 —— 字符串比较散落。

**Action**：Phase 6 时做单一 canonical 源：

- 后端 enum `AgentExecMode` + `as_str()` 是 single source of truth。
- 前端 `ALL_AGENT_EXEC_MODES` 由 codegen 或手动同步声明，**禁止**在 UI 文件里硬编码 `mode === "wingman"` 之类的字符串字面量。

未完成的子任务：grep 前端 `mode === "<具体字符串>"` 出现次数，找硬编码。

## 2. Tauri command 字符串：~915 处硬编码

`src-tauri/src/commands/handler_list.inc` 列出 ~915 条 `module::path::fn_name`。前端用 `invoke("<command_name>", ...)` 调，**字符串硬编码**。

**当前状态**：未发现 canonical 类型化包装层；每个 `invoke()` 调用都用裸字符串。

**ROI**：低（每个命令前端使用频率有限，且 TypeScript 没有等价 type-check 工具）。
**Action**：列入 follow-up，不进 Phase 2-8。

## 3. mode / tab key / model 字符串散落

未完成深扫。Phase 6 之前需 grep：

- `mode: "<...>"` / `mode === "<...>"`
- `tab: "<...>"` / `tabKey === "<...>"`
- `model: "<...>"`（含 OpenAI/Anthropic/Google 模型 ID）

预期会发现散落硬编码，每处都该有 canonical const 源。

## 4. Chat 输入 surface maxHeight 重复

memory `workspace_chat_input_surfaces_matrix.md` 记录 4 个独立实现：

- `src/features/SessionCreator/EditorArea.tsx` —— ternary `isChatPanel ? 140 : 300`
- `src/engines/ChatPanel/InputArea/ComposerInput.tsx`
- `src/components/UserChatItem`
- `src/engines/ChatPanel/blocks/AgentMessageBlock`

**风险**：每次"input 撑大了"的 bug 需要分别检查 4 处。

**评估**：🟡 中等合并工作量。可以提一个 `useChatInputMaxHeight(variant)` hook 或 layout primitive。但 4 处 surface 的 maxHeight 在不同语境下值不同（compact vs full），不一定该统一。

**Action**：Phase 6 step 2。先列出 4 处当前值，**用户决策**是否合并。

## 5. Context-pill prefix list

memory `workspace_composer_pill_context_prefix_extension.md` 记录 `CONTEXT_PILL_PREFIXES`（前端 const）+ `PillIconType` + `pasteHandlers.ts`。

**当前状态**：已有 canonical 源（单一 const + 单一 paste handler 分支表）。✅ 无重复。

不列入 Phase 6。

## 6. Sync 模块的 `Local` / `Remote` 命名

后端 `src-tauri/crates/.../sync/` 内：

- `AppliedSide` 用 `Local` / `Remote`
- `ConflictResolution`（adapter）用 `KeepLocal` / `UseRemote`
- `ConflictResolution`（conflict_log）用 `UseLocal` / `UseRemote`

**风险**：跨 enum 阅读时 `Keep*` 和 `Use*` 含义不一致 —— 用户决策"保留本地"和"使用本地"在 UI 上语义近乎相同，但 wire 不同。

**Action**：Phase 6 时同步前端 UI 标签（如果有"keep local" / "use local" 按钮）和后端 enum variant 的命名口径。

## 7. tab 系统跨层

memory `workspace_tab_systems_inventory.md` 记 8 套 tab 系统。

- 后端有自己的 session tab / replay tab 概念？未深查。
- 前端 8 套 tab 实现是否每套都有自己的 `Tab` interface？未深查。

**Action**：tab 系统重复（前端 §4）合并完后回头看跨层。

## OPEN questions

1. **mode 硬编码字符串清理范围**：只清前端，还是前后端 enum/as_str() 一起对账？
2. **`invoke()` 命令名字符串硬编码**：是否值得做 codegen 包装层？还是接受"~915 条字符串"现状？
3. **chat 输入 surface 4 处 maxHeight** 是否合并？合并后值能否抽象（不同 variant 值不同）？

---

**审计范围声明**：本文件由主上下文综合两个 subagent + memory 索引推断。具体 grep 数据未深扫（避免覆盖前后端报告已有的内容）。Phase 6 执行前需先做"硬编码字符串 grep + 当前值列表"。
