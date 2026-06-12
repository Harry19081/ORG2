# Frontend UI Audit — PanelTabBar

**File:** `src/modules/WorkStation/shared/PanelTabBar/index.tsx` (264 LOC, after 2026-06-12 light cleanup + upstream cursor-reset merge)
**Date:** 2026-06-12
**Auditor:** orgii session (follow-up to 2026-06-12 tab-systems inventory)
**Skill:** `~/.orgii/skills/frontend-ui-audit/SKILL.md`

## Why this file

Two separate signals pushed this audit:

1. A draft inventory pass in the same session called PanelTabBar "the only high-ROI consolidation target — collapse into `TabPill iconOnly`, save ~50–80 LOC". That estimate was made without reading `TabPill/index.tsx` side-by-side. After reading both files together, the verdict was reversed; this audit captures the **concrete blockers** in a single `keep with reason` document so the next auditor doesn't re-suggest the merge.
2. A light cleanup landed the same day (extracting `PanelTabButton` from `IconTabStrip`) reduced one nesting level; the file is otherwise unchanged. Reviewing it through the 5-dimension lens is the right moment.
3. During rebase onto `origin/main`, upstream commit `c482fdd3 fix(ui): reset cursor after navigation clicks` (Harry, same day) had independently shipped the same `PanelTabButton` extraction + `renderPanelTabIcon` helper, plus an additional `useImmediateCursorReset` hook (active-tab cursor reset). Upstream's version was kept — superset of our changes. None of the D1–D5 verdicts shift; line numbers in the tables below reflect the merged file (264 LOC).

## TL;DR

- **0 D1 violations**, but the raw-`<button>` story is non-obvious — three explicit reasons why `TabPill` cannot host it.
- **0 D2 violations.** Only design-system tokens used.
- **0 D3 violations**, 1 noted-but-deferred candidate (`text-[12px]` ↔ `text-xs` are pixel-identical; rewrite is grep-noise reduction only, deferred to the `D3-typography-scale-sweep.md` batch).
- **0 D4 violations.** The `aria-label` + `aria-selected` + `role="tab"` triad is correctly applied.
- **1 D5 observation**: this is the third sticky/chrome tab-strip pattern in the codebase (after WorkStation `TabBar` and `ReplayTabBar`); not yet promoted, watch-list only — the three are deliberately distinct, not duplicates.

## D1 — Raw HTML vs Design System

| Line               | Element                                                                            | Verdict              | Reason                                                                                                                                                                                                                                                                                                                                                          | Suggested change   |
| ------------------ | ---------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 118 | `<button role="tab">` inside `PanelTabButton`                                      | **keep with reason** | DS `TabPill` (`src/components/TabPill/index.tsx`) cannot host this tab strip without three additive features that no other consumer needs. See "Why not TabPill" below. Also: sibling Workstation chrome (`SessionReplay/ReplayTabBar.tsx`, `shared/TabBar/components/SortableTab/index.tsx`) also self-render `role="tab"` — the established local convention. | — (do not migrate) |
| 137, 139, 144 | inline icon `<IconComponent>`, `<span>` label, `<span>` badge                      | keep                 | Decorative children inside the labelled parent `<button>`                                                                                                                                                                                                                                                                                                       | —                  |
| 163 | `<div className="flex items-center gap-px">` strip wrapper                         | keep                 | Pure layout primitive; D1 rule explicitly exempts `<div>` wrappers                                                                                                                                                                                                                                                                                              | —                  |
| 218, 221, 240, 246 | `<div>` wrappers for outer chrome / tab row / persistent actions / per-tab actions | keep                 | Pure layout primitives                                                                                                                                                                                                                                                                                                                                          | —                  |

### Why not `TabPill` — three concrete blockers

The earlier "high-ROI" claim assumed `TabPill iconOnly` could host this strip. Reading `src/components/TabPill/index.tsx` (440 LOC, ~95 import sites) falsifies that:

1. **No `labelMode="active-only"`**. PanelTabBar in `position="right"` shows the label **only on the active tab** and falls back to icon-only with a tooltip on inactive tabs (`PanelTabBar/index.tsx:166-167, 181-188`). TabPill's `iconOnly` is a single boolean covering the entire strip — there is no per-state branch. Adding `labelMode` to TabPill would push this prop onto all ~95 consumers' surface area for the benefit of one.
2. **Square vs capsule active shape**. PanelTabBar's active is `rounded h-8 w-8 + bg-fill-1 + text-primary-6` (square, `PanelTabBar/index.tsx:127-134`). TabPill's `pill` variant is `rounded-[100px]` (capsule, `TabPill/index.tsx:301-307`). Forcing `iconOnly` over a capsule produces a hand-visible regression in the panel chrome — and "make TabPill square" means either a new `shape` prop (again, pollutes 95 sites) or a CSS escape hatch via `className` that wouldn't survive the slider/active-state logic.
3. **Missing tooltip slot**. PanelTabBar wraps every icon-only tab in `WorkstationToolbarTooltip` (`PanelTabBar/index.tsx:181-188`), which is itself a `Tooltip` + `KeyboardShortcutTooltipContent` composition with smart placement. TabPill has zero tooltip concept (`SidebarTabButton.tsx:30` uses a native `title` attribute only for sidebar variant). Hosting PanelTabBar under TabPill silently loses the tooltip affordance for icon-only tabs — both an a11y and a discoverability regression.

The merge is genuinely possible, but the cost is **three new props on the design-system basic** for the benefit of **two consumer files** (`Browser/Panels/BrowserSecondaryPanel/components/WebDevTools/index.tsx` and `CodeEditor/Panels/EditorBottomPanel/components/BottomPanelHeader.tsx`). That tradeoff fails frontend-ui-audit's "core principle: case-by-case, not rule-counting" — TabPill exists to factor out shared visual identity across 95 sites, not to absorb every tab-shaped strip in the codebase.

**Verdict shipped in memory** (`workspace_tab_systems_inventory.md`): not a merge target until/unless TabPill grows `labelMode` / `shape` / tooltip slot in a separate, scoped effort.

## D2 — Arbitrary Tailwind Value vs Token

| Line | Value                                                                           | Verdict | Reason                                                                                                                        | Suggested change |
| ---- | ------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 219  | `bg-workstation-bg` on outer wrapper                                            | keep    | `workstation-bg` is mapped in `tailwind.config.js`; this is the correct token-class form. Not an arbitrary value.             | —                |
| 133, 134 | `bg-fill-1`, `text-primary-6`, `bg-surface-hover`, `text-text-1`, `text-text-2` | keep    | All design-system tokens (`fill-1`, `primary-6`, `surface-hover`, `text-1`, `text-2`) — no arbitrary `var(--…)` substitutions | —                |

**No D2 violations.** All color/background tokens routed through `tailwind.config.js` mappings.

## D3 — Hardcoded Sizes / Colors

| Line     | Value                                                       | Verdict         | Reason                                                                                                                                                                                                                                                                                                       | Suggested change |
| -------- | ----------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| 127, 130 | `h-8` / `w-8` / `px-2` on the tab button                    | keep            | All Tailwind spacing-scale tokens (`h-8` = 32 px, `w-8` = 32 px, `px-2` = 8 px). Square 32 px hit area matches WebDevTools / CodeEditor chrome convention.                                                                                                                                                   | —                |
| 76       | `ICON_SIZE = 14` (constant, passed to `IconComponent size`) | keep            | Lucide icon prop, not a Tailwind class; matches the 14 px chevron family used across DiffFileSection and FileHeader.                                                                                                                                                                                         | —                |
| 139      | `text-[12px] font-medium` on label span                     | keep (deferred) | 12 px maps to `text-xs` in the project's `tailwind.config.js`. Pixel-identical rewrite — pure grep-noise reduction. **Per this directory's README "do not modify source code" policy, deferred to the `D3-typography-scale-sweep.md` batch** rather than fixed in this audit. Not a violation; not blocking. | —                |
| 144      | absolute badge anchor `-right-0.5 -top-0.5`                 | keep            | Tailwind half-step spacing (`-right-0.5` = -2 px); optical microadjustment for the badge corner. Sub-scale by design.                                                                                                                                                                                        | —                |

## D4 — Accessibility

| Line    | Element                                                               | Verdict | Reason                                                                                                                                                                                                                                                      | Suggested change |
| ------- | --------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 118–148 | `<button role="tab" aria-label={tab.label} aria-selected={isActive}>` | keep    | Accessible name via `aria-label`; selection state via `aria-selected`; keyboard handled by native `<button>` semantics. Triple-bind (`aria-label` + visible label when `showLabel` + tooltip when icon-only) is intentional for the active-only label mode. | —                |
| 181–188 | `WorkstationToolbarTooltip` wrapping icon-only tabs                   | keep    | Provides hover text + smart placement + optional keyboard shortcut hint. **Critical** for `labelMode="never"` and inactive tabs in `labelMode="active-only"` — without it, icon-only tabs would have no discoverability beyond `aria-label`.                | —                |
| 137 | `renderPanelTabIcon(tab.icon)` | keep    | Decorative icon inside a labelled `<button>`; lucide icons don't add `<title>` by default and don't need to — parent is labelled.                                                                                                                           | —                |
| 143–147 | badge `<span>` (absolutely positioned)                                | keep    | `pointer-events-none` keeps it from blocking the click target; visual-only. No interactive semantics required.                                                                                                                                              | —                |

**No D4 violations.** This file is, if anything, **better** than the surrounding chrome — `aria-label` is set unconditionally, not only when the visible label is hidden.

### A11y gotcha worth noting (not a violation, just a tradeoff)

When `showLabel === true`, the visible label and `aria-label` carry the same text — screen readers may double-announce. This is the lesser of two evils: stripping `aria-label` when the visible label is present would force every reader of this file to remember "the accessible name depends on the labelMode prop", which is a worse trap than the double-announce. **Keep.** If a future a11y pass shows this is noisy in practice, switch to `aria-labelledby` pointing at the visible-label span (small change, well-contained).

## D5 — Repeated Visual Patterns

Watch-list (running across the multi-file audit):

| Pattern                                                                        | Where                                                                                                          | Count      |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------- |
| sticky file header + chevron + filename + stats badge + status letter          | `DiffFileSection`, `FileHeader` (flat-path variant)                                                            | 2          |
| `role="tab"` icon-only square button strip in panel chrome                     | `PanelTabBar` (this file) and `ReplayTabBar` (`src/modules/WorkStation/shared/SessionReplay/ReplayTabBar.tsx`) | 2          |
| panel chrome tabstrip + per-tab actions + position toggle + persistent actions | `PanelTabBar` only                                                                                             | 1          |
| tooltip-wrapped icon-only chrome button                                        | Many (uses `WorkstationToolbarTooltip` — already abstracted as the shared primitive)                           | abstracted |

**No promote candidates this round.** The two `role="tab"` square-button strips (this file and `ReplayTabBar`) are visually similar but semantically different: PanelTabBar drives a **mutable** view with per-tab actions and position toggle; ReplayTabBar drives a **read-only** replay timeline with no per-tab actions and reuses #1's `WorkStationTabPillSurface` for its visual identity. Folding them would inherit the same "merge into TabPill" trap at one level lower. Watch-list, no action.

## Summary

- 0 D1 violations (1 `keep with reason` for the entire `<button>` strip — documented why TabPill cannot host it)
- 0 D2 violations
- 0 D3 violations (1 noted-but-deferred `text-[12px]` ↔ `text-xs` candidate; rewrite is pixel-identical, deferred per directory README's no-source-edit policy to the `D3-typography-scale-sweep.md` batch)
- 0 D4 violations
- 0 D5 promote candidates (1 watch-list entry: two `role="tab"` square strips in chrome)

**Total recommended changes**: 0. Per the directory README, this audit reports only — landing the optional `text-[12px]` → `text-xs` consolidation belongs to the typography-scale sweep PR, not here.

## Cross-references

- `workspace_tab_systems_inventory.md` — Inventory of 6 tab systems; the verdict on PanelTabBar's independence is mirrored there.
- `docs/frontend-ui-audit-2026-06-11/D3-typography-scale-sweep.md` — Project-wide `text-[Npx]` sweep; this file contributes one entry (line 139).
- `~/.orgii/skills/frontend-ui-audit/SKILL.md` — D1–D5 methodology.
- `~/.orgii/skills/architecture-audit/SKILL.md` — Anti-pattern #6 (cross-domain concept leakage) is why "add `WorkstationToolbarTooltip` slot to TabPill" was rejected as a path forward.

## Outcome

PanelTabBar's independence from `TabPill` is documented as deliberate, with three concrete blockers preventing a low-cost merge. Future audits that arrive at the same "consolidate the panel chrome tabstrip" question should read this file first; if any of the three blockers (label mode, square shape, tooltip slot) is independently addressed in TabPill, revisit this verdict at that point.
