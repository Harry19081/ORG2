# SimulatorTreePanel UI audit

| Line                                                                                     | Element              | Verdict          | Reason                                                                                                                                                                                            | Suggested change |
| ---------------------------------------------------------------------------------------- | -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `src/modules/WorkStation/CodeEditor/SessionReplay/components/SimulatorTreePanel.tsx:120` | File-path hover card | keep with reason | Reuses `FileTreePreview` inside the existing smart-positioned `Tooltip`, with the shared 500 ms delay; the outer tooltip is transparent and unpadded so only the existing card supplies its frame | None             |
| `src/modules/WorkStation/CodeEditor/SessionReplay/components/SimulatorTreePanel.tsx:87`  | File row             | keep with reason | Retains `TreeRowBase` selection and click behavior; the existing tooltip trigger preserves the full-width row                                                                                     | None             |

Verdict totals: **0 fix**, **2 keep with reason**, **0 abstract**.

Scope: changed hover composition. The existing Tooltip's smart placement is retained. Desktop viewport-edge appearance was not visually verified because computer control was not authorized.
