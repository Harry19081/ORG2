# Frontend UI Audit — DiffStatsBadge (consolidation + call-site migration)

**File:** `src/components/DiffStatsBadge/index.tsx` (78 LOC) + ~18 migrated call sites
**Date:** 2026-06-17
**Auditor:** frontend-ui-audit (Cursor session)
**Source commit:** `afdd30bf refactor(diff-stats): consolidate +/- stat rendering into DiffStatsBadge`

Scope: the new `plain` variant plus the `className` / `valueClassName` / `formatValue` /
`showAdditions` / `showDeletions` props, and the call sites migrated away from ad-hoc
`+N` / `-N` spans (chat blocks, code viewers, git dashboard, kanban, inbox, session-diff).

This migration is, on balance, a **net consistency win**: it removed ~18 hand-rolled
`+/-` span pairs and, in several sites, replaced raw Tailwind palette colors
(`text-green-500` / `text-red-500`) and hardcoded hex (`#2ea043` / `#f85149`) with the
project diff tokens (`text-success-6` / `text-danger-6` via `DIFF_STATS`). The findings
below are the residual debt, not a rejection of the change.

## D1 — Raw HTML vs Design System

| Line                                                                       | Element                                           | Verdict            | Reason                                                                                                                                                                                                            | Suggested change |
| -------------------------------------------------------------------------- | ------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| component-wide                                                             | `<span>` containers/values                        | keep with reason   | A stat badge is non-interactive inline text; `<span>` is the correct primitive. No DS element covers "inline tinted number pair".                                                                                 | —                |
| `TaskImpactLine/index.tsx` `<button className="task-impact-line__action">` | `<button>`                                        | keep with reason   | Inline text-link "N/A → refresh" affordance with `title` + visible text (accessible name OK). DS `Button` would impose chrome/padding that breaks the inline metadata row; sibling spans in the same row are raw. | —                |
| all migrated sites                                                         | ad-hoc `+{n}` / `-{n}` spans → `<DiffStatsBadge>` | fix (already done) | The whole point of the consolidation. No leftover ad-hoc `+N`/`-N` diff-stat spans remain in the repo (swept: only the badge's own internal `+{formatValue()}` matches).                                          | —                |

## D2 — Arbitrary Tailwind Value vs Token

| Line                                   | Value                                                                                     | Verdict          | Reason                                                                                                                                                                                                                                                                | Suggested change                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `index.tsx:26`                         | `min-w-[3ch]` (VALUE_CLASSES)                                                             | keep with reason | `ch` is an intentional character-unit width for tabular alignment of the number column; there is no spacing token for character units.                                                                                                                                | —                                        |
| `index.tsx:19-20`                      | `${DIFF_STATS.container}` carries `text-[12px]`; `containerCompact` carries `text-[11px]` | keep with reason | Inherited verbatim from the pre-existing `DIFF_STATS` token in `src/config/workstation/tokens.ts` (lines 314-324); not introduced by this PR. 11px/12px have no default Tailwind text scale class, so the project already standardizes on the arbitrary literal here. | — (track at token level, not site level) |
| `DiffSummary.tsx`                      | `className="text-[11px]"`                                                                 | keep with reason | Matches the established `DIFF_STATS` 11px convention; `plain` variant deliberately ships no font-size (see D5).                                                                                                                                                       | — (see D5 sweep candidate)               |
| `SessionLinkCard.tsx` (file-row badge) | `className="text-[12px]"`                                                                 | keep with reason | Same: caller supplies the font-size because `plain` has none. Consistent with the 12px convention.                                                                                                                                                                    | — (see D5 sweep candidate)               |

## D3 — Hardcoded Sizes / Colors

| Line                                               | Item                                                   | Verdict                                  | Reason                                                                                                                                                           | Suggested change   |
| -------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| migrated sites (DiffBlock, SessionLinkCard, etc.)  | removed `text-green-500` / `text-red-500`              | fix (already done)                       | Raw Tailwind palette colors replaced by project tokens `text-success-6` / `text-danger-6`. Repo-wide sweep confirms zero remaining raw-palette diff-stat colors. | —                  |
| `ModernSplitDiff.scss` / `index.scss` (CodeViewer) | removed `#2ea043` / `#f85149` / `rgba(...)` pill fills | partial — see `OrphanedDiffStatsSCSS.md` | Hex removed from `index.scss` and `GitHubDiff/index.scss`, but the equivalent nested rules survive orphaned in `ModernSplitDiff.scss`.                           | tracked separately |

## D4 — Accessibility

| Line                                | Element                          | Verdict          | Reason                                                                                                                            | Suggested change |
| ----------------------------------- | -------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `index.tsx:50-73`                   | badge `<span>`s                  | keep             | Decorative inline text with literal `+`/`-` prefixes; no interactivity, renders `null` when empty. No accessible-name obligation. | —                |
| `TaskImpactLine` refresh `<button>` | `<button title=... onClick=...>` | keep with reason | Has visible text ("N/A") + `title`; native button = keyboard accessible.                                                          | —                |

## D5 — Visual Patterns Observed

- **Sweep / abstract candidate — `plain` variant has no intrinsic font-size, so every `plain`
  call site re-specifies it externally.** Observed in ≥5 sites: `DiffSummary` (`text-[11px]`),
  `SessionLinkCard` (`text-[12px]`), and via SCSS in `ModernSplitDiff` (`.header-stats` 11px),
  `GitHubDiff` (`.github-diff-stat` 12px), `TaskImpactLine` (`.task-impact-line__diff` 12px).
  This is the design-system gap the consolidation half-closed: `default`/`compact` bake in
  12px/11px, but `plain` punts sizing to the caller, recreating per-site size drift. Per
  _Systematic Sweep Discipline_, do **not** patch each call site — decide once at the component
  level (e.g. a `size`/`textClassName` prop, or `plain-sm`/`plain` size variants that map to the
  same 11px/12px the rest of the system uses). Surfaced as a single sweep candidate.
- **Separator drift (minor).** `DiffSummary` previously rendered a `text-text-4` `/` divider
  between additions and deletions and used `gap-1.5`; the `plain` badge has no separator and uses
  `gap-1`. Cosmetic, consistent with other badge sites; noted for visual-parity awareness, no action.
- **Duplicated class string.** `plain` and `chat` container strings both inline
  `font-mono font-medium leading-none tabular-nums` rather than sharing a constant. DRY nit only,
  not a token/consistency violation — keep.

## Summary

- **fix:** 0 net-new (the migration itself is the fix; ad-hoc spans and raw palette colors already removed)
- **keep with reason:** 8
- **abstract / sweep candidate:** 1 (`plain` variant font-size externalization across ≥5 sites)
- Cross-reference: hardcoded-hex / orphaned-rule fallout tracked in `OrphanedDiffStatsSCSS.md`.
