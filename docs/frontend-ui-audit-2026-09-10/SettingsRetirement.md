# SettingsRetirement UI audit

This implementation retires unreachable settings code. It introduces no new controls, visual patterns, sizes, colors, or accessibility behavior.

| Line                                                                                                                    | Element                    | Verdict          | Reason                                                                                                                                                         | Suggested change |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `src/modules/MainApp/Settings/renderer/SettingsSectionRenderer.tsx:37`                                                  | Section shell              | keep with reason | The same section ID, scroll margin, spacing, custom slot and error fallback remain; only the unreachable container branch is deleted                           | None             |
| `src/modules/MainApp/Settings/subpages/EditorAppearancePage/index.tsx:1`                                                | Editor appearance sections | keep with reason | Three live named components retain their shared SectionLayout and design-system controls; only the unimported standalone page wrapper is removed               | None             |
| `src/modules/MainApp/Settings/sections/AppIconPicker.tsx:41`; `src/modules/MainApp/Settings/sections/SkinSwatch.tsx:19` | Appearance previews        | keep with reason | Only unused default-export aliases are removed; native radio semantics, dynamic skin colors and preview geometry remain intact                                 | None             |
| `src/modules/MainApp/Settings/sections/NotificationsTab.tsx:20`                                                         | Notification composition   | keep with reason | The live master toggle and advanced blocks still compose directly using SectionContainer and SectionRow; the comment no longer claims a row registry uses them | None             |

Verdict totals: **0 fix**, **4 keep with reason**, **0 abstract**.

Verification: section-dispatch tests use the real manifest, route parser and registry with leaf pages stubbed; existing notification, storage and mobile-remote suites cover retained controls. No screenshots were captured because the change intentionally preserves rendered UI and removes unreachable source. Desktop UI control was not used. The separate metadata-consolidation and Appearance-row extraction opportunities are outside this PR.
