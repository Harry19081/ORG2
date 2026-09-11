# Consolidated Find card UI audit

| Line                                                                                                      | Element                  | Verdict          | Reason                                                                                                                                   | Suggested change |
| --------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `src/components/FindCard/index.tsx:150`                                                                   | Floating shell and input | keep with reason | Reuses Spotlight panel token and compact SpotlightSearchBar for both engines                                                             | None             |
| `src/components/FindCard/index.tsx:180`                                                                   | Session/File selector    | keep with reason | Reuses SegmentedTextPill with chat-bubble/document icons, accessible labels, tooltips, selected state and disabled unavailable scope     | None             |
| `src/components/FindCard/index.tsx:220`                                                                   | Match options            | keep with reason | Shared Button soft appearance derives selected styling from aria-pressed                                                                 | None             |
| `src/modules/WorkStation/CodeEditor/Panels/EditorMainPane/components/CodeMirrorSearchPanel/index.tsx:280` | Replace row              | keep with reason | Existing ReplaceInput retains replace-next/all semantics; hidden on read-only editors                                                    | None             |
| `src/modules/WorkStation/CodeEditor/Panels/EditorMainPane/components/CodeMirrorSearchPanel/index.tsx:330` | Editor overlay           | keep with reason | User requested a floating consolidated card; CodeMirror panel retains lifecycle ownership while the card lives at the outer surface edge | None             |

Verdict totals: **0 fix**, **5 keep with reason**, **0 abstract**.

Source and automated verification only; native visual verification was not run because computer control was not requested.
