# 前端死代码 + 重复实现 findings

> 范围：`src/`。本次审计因前端 explore subagent 中断，部分维度由主上下文用 ripgrep 直接复核（覆盖 dead module / dead export / ChatPanel engine 结构 / 发送路径 / 多源真相 atom）。Tab 系统残余 + 空目录扫描列入 follow-up。

## 1. Dead modules（高置信度可删）

| 文件                                   | 大小                   | 引用数                                   | 风险                                         | 建议     |
| -------------------------------------- | ---------------------- | ---------------------------------------- | -------------------------------------------- | -------- |
| `src/util/platform/tauri/gitBundle.ts` | ~250 行（来自 memory） | 0（三 pattern 均未命中 `gitBundle`）     | 跨语言搜过 `*.rs` 无命中；非 `window.*` 全局 | **删除** |
| `src/util/dialogs/openLinkDialog.ts`   | 抽样 1 文件            | 0（grep `openLinkDialog`：只有自身命中） | 同上                                         | **删除** |

**不再列入**（memory baseline 已过期）：

- `localStorage.ts` → 被 `useAppDeferredInitialization.ts:26` 用。
- `deferredInit.ts` → 被 `useFirstPaintSignal.ts:21` 用。
- `gitActionDialog.ts` → 12 处用。
- `channelActionDialog.ts` → 1 处用。
- `gitAuthenticationDialog.tsx` → 1 处用（`src/services/git/operations/remoteOps.ts:12`）。

## 2. Dead `export default` 关键字（保留 named 导出，只删 default）

14 个 service 文件全部既有 `export default` 也提供 named 导出。grep `import\s+\w+\s+from.*<basename>` 全部 0 命中——证明所有调用者用 named import。删 `export default` 关键字 **零风险**：

| 文件                                                 | 行号 |
| ---------------------------------------------------- | ---- |
| `src/services/guiAgent/GUIAgentService.ts`           | 334  |
| `src/services/workStation/EditorTabService.ts`       | 176  |
| `src/services/workStation/EditorService.ts`          | 492  |
| `src/services/panel/PanelService.ts`                 | 71   |
| `src/services/git/GitOperationsService.ts`           | 83   |
| `src/services/search/SearchService.ts`               | 157  |
| `src/services/workStation/WorkStationViewService.ts` | 276  |
| `src/services/app/AppViewService.ts`                 | 50   |
| `src/services/file/FileService.ts`                   | 490  |
| `src/services/git/GitService.ts`                     | 469  |
| `src/services/terminal/TerminalService.ts`           | 288  |
| `src/services/test/TestService.ts`                   | 249  |
| `src/services/file/FileOperationsService.ts`         | 427  |
| `src/services/navigation/NavigationService.ts`       | 97   |

## 3. ChatPanel engine 错放（PanelView bloat）

`src/engines/ChatPanel/` 根下混了非 chat 的 7 个文件（验证于 2026-06-11，比 memory 记的 9+ 略少——`StickyNotesPanelView` 已搬走）。

| 错放文件                              | 建议归属                                          |
| ------------------------------------- | ------------------------------------------------- |
| `ProjectPanelView.tsx`                | `src/modules/Project/` 或 `src/features/Project/` |
| `WorkItemPanelView.tsx`               | `src/modules/WorkItem/`                           |
| `WorkspaceDashboardPanelView.tsx`     | `src/modules/Workspace/Dashboard/`                |
| `WorkspaceExplorePanelView.tsx`       | `src/modules/Workspace/Explore/`                  |
| `WorkspaceOverviewPanelView.tsx`      | `src/modules/Workspace/Overview/`                 |
| `BenchmarkRunBuilder.tsx`             | `src/features/Benchmark/`                         |
| `useBenchmarkSessionCreatorSlots.tsx` | `src/features/Benchmark/`                         |
| `LinkSessionToWorkItemModal.tsx`      | `src/modules/WorkItem/modals/`                    |

ChatPanel 根目录下应保留的（chat 真正相关）：

- `ChatView.tsx` / `ChatPanelContent.tsx` / `ChatPanelEmptyContent.tsx` / `ChatPanelHeader.tsx`
- `ChatFloatingComposer.tsx`
- `ChatHistoryOverrideContext.ts` / `ChatSessionContext.ts`
- `config.ts` / `types.ts` / `index.tsx`
- 目录：`adapters/`、`blocks/`、`ChatItems/`、`ChatHistory/`、`components/`、`events/`、`header/`、`hooks/`、`navigation/`、`rendering/`、`InputArea/`、`ThreadSelector/`

**ROI 评估**：纯 file move + 全 import 路径更新。无行为变化，git blame 一次性变更但 commit message 标 `chore: move <files> to <module>` 即可。

## 4. Tab 系统残余重复

**[partial - 未完成]** 前端 explore subagent 中断前没能跑完。memory `workspace_tab_systems_inventory.md` 列了 8 套：WorkStation TabBar / PrimarySidebarLayout / EditorBottomPanel / Communication / SessionReplay / SidebarModules / TabPill / WorkItem detail。已知 PanelTabBar 已经吸收 ①↔③。剩余 6 套是否仍然各自独立未验证。**Action**：follow-up 单独跑一次"用 `grep -l Tab` 在 src/ 列出 N 个独立 Tab 实现并对比 props 表"。

## 5. 发送路径重复（anti-pattern #21/#36/#53）

`dispatchMessageBySessionType` 在生产代码 **4 个文件、14 处调用**：

| 文件                                                                  | 行                           |
| --------------------------------------------------------------------- | ---------------------------- |
| `src/engines/ChatPanel/events/interactive_events/next-step/index.tsx` | 163, 236, 259                |
| `src/engines/ChatPanel/hooks/useWorkspaceChat/useWorkspaceChat.ts`    | 199, 393, 409, 426, 453, 468 |
| `src/engines/ChatPanel/hooks/useWorkspaceChat/useMessageDispatch.ts`  | 72, 162                      |
| `src/engines/ChatPanel/ChatHistory/hooks/useEditUserMessage.ts`       | 66, 203, 231                 |

**预期形态**：只有 `useMessageDispatch.ts` 一个文件持有 dispatcher，其它都应该通过它走 intent → 队列状态机。当前状态明显违反 anti-pattern #53 的 "exactly one dispatcher owns append/dequeue/send"。

**ROI**：中（涉及 next-step 交互流程 + 编辑消息流程的语义梳理）；语义验收需要 e2e。本次只在报告里 flag，Phase 8 单独处理。

## 6. 多源真相 atom / shadow boolean（anti-pattern #51/#54）

memory `workspace_force_send_queue_dispatch.md` 声称几个旧 atom 已 GONE——本次复核**部分错误**：

### 6.1 `holdSessionQueueForStopAtom` — 仍活，是 shadow boolean

仍然存在并被读：

- `src/store/ui/messageQueueAtom.ts:164`（queue 决策点）
- `src/engines/SessionCore/control/sessionTimelineBoundary.ts:20, 132`
- `src/store/ui/__tests__/messageQueueAtom.test.ts:13, 220, 223, 232, 248`

**违反**：anti-pattern #51 "Separate 'hold' atom duplicating FSM state"。FSM 已有 `stopping` phase 应该取代它。

### 6.2 `userInitiatedCancelAtom` — 仍活，是 multi-purpose atom

被读：

- `src/store/session/cliSessionStatusAtom.ts:174, 175`
- `src/engines/SessionCore/control/sessionTimelineBoundary.ts:17, 128, 134`
- `src/engines/SessionCore/hooks/session/useQueueDispatch.ts:49, 193`
- e2e helpers（不算）

**违反**：anti-pattern #54 "Multi-purpose cancel atom causing cross-concern bleed"。名字本身就承载了 (a) "post-Stop dispatch priority" 和 (b) "draft restoration gate" 两个 concern。

### 6.3 `forceSendPendingQueueAtom` — 已死（确认）

只剩 `src/app/root/e2e/helpers/sessionHelpers/inspectChatState.ts:147` 引用——纯 e2e helper。可以删除 atom 定义 + 改 e2e helper（同 PR）。

## 7. Legacy mode / 死分支

**[partial - 未完成]**。memory `workspace_agent_exec_mode_display_wire_split.md` 提示 `wingman` / `review` / `debug` 等 wire-union 中的 mode 在 picker 中已经不可选。需 grep `AgentExecMode` enum + `mode === "wingman"` 等死分支。本次未跑。

## 8. 空目录 / 单文件目录

**[partial - 未完成]**。前端 subagent 中断前未跑。Follow-up 用 `find src -type d -empty` + 对每个一级子目录统计 `*.ts*` 数量。

## 9. Markdown / chat-block-content 缺失

ripgrep `chat-block-content` 命中 **35+ 个文件、80+ 处**。覆盖 ChatPanel/blocks/_ / ChatPanel/events/_ / ChatPanel/ChatItems/_ / InputArea/_ 全套。**未发现缺失**——主要 chat surface 都包了 typography wrapper。memory `workspace_chatpanel_chat_block_content_typography.md` 记录的修法已经渗透。

如果 Phase 1-8 引入新 chat surface，需在该 PR 内自检。

## 10. 其他偶然发现

- `src/router/routes/OpenSourceMarketUnavailablePage.tsx:29` 等 ~80 个 `export default` 是组件入口，**不该删**——只删 service 文件的（§2）。
- memory `workspace_agent_events_via_websocket.md` 写的 WS-as-debug-tee 当前状态本次未复核——延后。
- `src/util/dialogs/` 目录下文件名既有 `.ts` 也有 `.tsx`（gitAuthenticationDialog 是 tsx），归类规则不一致。**不在 ROI 排序里**。

## OPEN questions（需要用户决策的）

1. **Phase 2 是否一次性把 14 个 service `export default` 一起删？**（answer 默认是）
2. **Phase 3 用 `git mv` 拆 1 个 PR 还是每个 PanelView 一个 PR？**（建议 1 个 PR，commit message 清晰即可）
3. **Phase 7 `holdSessionQueueForStopAtom` 删除是否要先重跑队列 e2e？**（强烈建议要——这是已经在生产里活了一阵子的 atom，删错了会让 Stop 后第一条消息掉）
4. **Phase 8 发送路径合并是否要拆成多个 PR？**（建议 next-step / edit-user-message / useWorkspaceChat 各一 PR，每个有自己的 e2e）
5. **Tab 系统 + 空目录 + legacy mode 三个未跑完的维度是否要做 follow-up audit？**（开 follow-up 任务）
