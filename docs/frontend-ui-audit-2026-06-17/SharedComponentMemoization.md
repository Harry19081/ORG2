# Frontend UI Audit — Shared-component memoization batch

**Files:** `src/components/Button/index.tsx`, `Tag/index.tsx`, `StackListRow/index.tsx`, `Menu/index.tsx`, `Checkbox/index.tsx`, `Radio/index.tsx`, `Collapse/index.tsx`, `Form/index.tsx`
**Date:** 2026-06-17
**Auditor:** frontend-ui-audit (Cursor session)
**Source commits:** `23292c50 perf(components): memoize Button styles and memo Tag/StackListRow`, `8fbe769c perf(components): memoize compound-component context values`

Audited **only** for UI-consistency / design-system concerns (the skill's scope); the
performance dimension was already handled by `architecture-audit` and is out of scope here.

## What changed (UI-relevant surface)

| File                                                | Change                                                                                                                  | UI/DS surface touched?                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `Button/index.tsx`                                  | `getBorderRadius()`/`getButtonStyles()` → `useMemo`'d `borderRadius`/`buttonStyles`; split-button reuses `borderRadius` | **No** — identical style object values, no className/token edits |
| `Tag/index.tsx`                                     | `export default Tag` → `React.memo(Tag)`                                                                                | No                                                               |
| `StackListRow/index.tsx`                            | named export → `React.memo(StackListRowComponent)`                                                                      | No                                                               |
| `Menu` / `Checkbox` / `Radio` / `Collapse` / `Form` | Provider `value` wrapped in `useMemo`                                                                                   | No                                                               |

## D1–D4

No raw-HTML, arbitrary-Tailwind, hardcoded-size/color, or a11y changes were introduced. The
diffs are referential-stability refactors (`useMemo` / `React.memo`) with byte-identical style
and className output. Per the skill's **"When NOT To Use" → single-purpose perf change**, there
is no UI-consistency surface to flag.

> Note (pre-existing, **not** introduced by this batch): `Button/index.tsx` builds its sizing via
> inline `style` literals (`borderRadius: "8px"`, `"100px"`, `border: "none"`, etc.) rather than
> tokens. These predate this PR and were only moved inside `useMemo`, so they are out of scope for
> this audit. Recorded here as a watch-list item, not a verdict against this change.

## Summary

- **fix:** 0
- **keep with reason:** 0 (no in-scope hits — perf-only diff)
- **abstract / sweep candidate:** 0
- Watch-list: Button inline-style sizing literals (pre-existing; revisit in a dedicated Button audit).
