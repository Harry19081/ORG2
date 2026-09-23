# PrFlowHeader UI audit

| Line                      | Element                | Verdict          | Reason                                                                                                                          | Suggested change |
| ------------------------- | ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `PrFlowHeader.tsx:50`     | Branch name pill       | keep with reason | Existing compact code presentation fits the flow sentence and truncates long names with a full-name tooltip.                    | None.            |
| `PrFlowHeader.tsx:209`    | Inline title editor    | keep with reason | Uses the shared 32px `Input` with built-in save and cancel actions, a title label, and pending state.                           | None.            |
| `PrFlowHeader.tsx:225`    | Pen edit action        | keep with reason | Uses shared `Button` icon, `iconOnly`, size, and variant props with an accessible name and tooltip.                             | None.            |
| `PrFlowHeader.tsx:255`    | Target branch picker   | keep with reason | Uses shared `Dropdown` and `Button` inline after the merge phrase; the code pill matches the branch presentation.               | None.            |
| `DetailFlowHeader.tsx:77` | Title action alignment | keep with reason | Shared header slot centers the action with the heading while preserving the existing heading for callers without title editing. | None.            |

Verdict totals: **0 fix**, **5 keep with reason**, **0 abstract**.
