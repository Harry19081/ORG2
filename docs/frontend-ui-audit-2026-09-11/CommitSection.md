# CommitSection UI audit

Updated for the spotlight follow-up on 2026-09-12.

| Line                    | Element            | Verdict          | Reason                                                                                                                                                     | Suggested change |
| ----------------------- | ------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `CommitSection.tsx:246` | Control spacing    | keep with reason | Sidebar keeps its existing inset; spotlight controls have no padding so the dialog owns the single consistent p-3 inset                                    | None             |
| `CommitSection.tsx:493` | Message field      | keep with reason | Reuses Textarea with an accessible label and autofocus; rendered coverage verifies initial focus                                                           | None             |
| `CommitSection.tsx:644` | Sidebar launcher   | keep with reason | Original full-width controls open the composer before a message exists; execution validation stays inside                                                  | None             |
| `CommitSection.tsx:656` | Spotlight composer | keep with reason | Reuses SpotlightShell for standard width, placement, backdrop and Escape handling; a labelled dialog contains shared Button controls and one padding layer | None             |

Verdict totals: **0 fix**, **4 keep with reason**, **0 abstract**.

D1–D5 reviewed. No shared-component sweep is required. Rendered tests cover spotlight mounting, autofocus, commit validation, menu options, Escape, reopening with the controlled draft, and close-button dismissal. Desktop visual verification was not performed because computer control was not authorized. The shared spotlight shell does not provide the former ModalSystem Tab focus trap or automatic focus restoration; keyboard traversal remains an unverified shared-shell limitation.

Lifecycle inspection: the spotlight subtree mounts only while open, so its overlay registration and Escape listener are released on close; no new polling, cache, or background requests are introduced. Close/reopen/unmount are covered by the rendered test. Native idle CPU/RSS and hidden-window behavior were not measured.
