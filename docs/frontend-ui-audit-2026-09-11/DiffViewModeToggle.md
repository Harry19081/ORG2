# DiffViewModeToggle UI audit

Scope: shared diff layout button and its two header integrations. Reviewed D1–D5; no arbitrary values, colors, or new background work introduced.

| Line                                                                                                     | Element                    | Verdict          | Reason                                                                                                                                                                                                                             | Suggested change |
| -------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `src/modules/shared/components/DiffViewModeToggle.tsx:96`                                                | Icon button                | keep with reason | Reuses the design-system Button with native keyboard behavior, a destination-specific translated title and accessible name.                                                                                                        | None.            |
| `src/modules/shared/components/DiffViewModeToggle.tsx:106`                                               | Layout icon                | keep with reason | Adapts the installed Hugeicons outline with muted deletion/addition fills using DIFF_STATS theme tokens; glyph geometry shows the current layout. Uses the header size token. Decorative icon is hidden from assistive technology. | None.            |
| `src/modules/shared/components/FileHeader/index.tsx:448`                                                 | File diff layout control   | keep with reason | Uses the shared toggle and retains the existing visibility gate and mode callback.                                                                                                                                                 | None.            |
| `src/modules/WorkStation/CodeEditor/Panels/EditorMainPane/components/SourceControlHeaderContent.tsx:232` | All Changes layout control | keep with reason | Uses the same shared toggle while preserving Focus / All Changes pills and existing aggregate-control visibility.                                                                                                                  | None.            |

Verdict totals: **0 fix**, **4 keep with reason**, **0 abstract**.

Visual verification: source inspection only; desktop UI control was not authorized.
