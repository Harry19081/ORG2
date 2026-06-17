# Frontend UI Audit — Orphaned diff-stat SCSS & pill visual regression

**Files:** `src/features/CodeViewer/ModernSplitDiff.scss`, `src/features/CodeViewer/index.scss`, `src/engines/GitWorkflow/GitHubDiff/index.scss`
**Date:** 2026-06-17
**Auditor:** frontend-ui-audit (Cursor session)
**Source commit:** `afdd30bf refactor(diff-stats): consolidate +/- stat rendering into DiffStatsBadge`

When the `+N`/`-N` spans were migrated to `<DiffStatsBadge variant="plain">`, the badge stopped
applying the old `additions` / `deletions` modifier classes to its container — color now comes
from the inner value spans via `text-success-6` / `text-danger-6` (`DIFF_STATS`). Three
stylesheets carried the old pill styling. Two were cleaned up; one was not. This is both **dead
CSS** and a **visual change** (the tinted "pill" background is gone repo-wide; color moved from
hardcoded GitHub hex to design tokens).

## Sweep result (3 stylesheets, one shared intent)

| File                                    | Old rule                                                                                                 | State after migration                                                                                                              | Verdict           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `CodeViewer/index.scss`                 | `.stats-additions` / `.stats-deletions` (12px, `#2ea043`/`#f85149`, `rgba(...)` pill)                    | **Removed** in the diff                                                                                                            | clean (no action) |
| `GitWorkflow/GitHubDiff/index.scss`     | `.github-diff-stat-add` / `.github-diff-stat-remove` (`var(--diff-add-text)` / `--diff-remove-text`)     | **Removed** in the diff; base `.github-diff-stat` retained (still used by `github-diff-stat-empty`)                                | clean (no action) |
| `CodeViewer/ModernSplitDiff.scss:82-98` | `.header-stats` base + nested `&.additions` / `&.deletions` (`#2ea043`/`#f85149` + `rgba(...)` 12% pill) | **Left behind** — TSX now sets `className="header-stats"` on the badge container only; `.additions`/`.deletions` are never applied | **fix candidate** |

## D2 / D3 — the orphaned rule

| Line                         | Item                                                                                                         | Verdict          | Reason                                                                                                                                                                                                                                     | Suggested change                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `ModernSplitDiff.scss:89-92` | `.header-stats.additions { color: #2ea043; background: rgba(46,160,67,0.12); }`                              | fix candidate    | Selector is unreachable — the migrated `<DiffStatsBadge>` never receives an `additions` class on its container (color is on inner spans via tokens). Dead CSS carrying a hardcoded hex + raw rgba.                                         | Delete the nested `&.additions` / `&.deletions` blocks (lines 89-97).                                              |
| `ModernSplitDiff.scss:94-97` | `.header-stats.deletions { color: #f85149; background: rgba(248,81,73,0.12); }`                              | fix candidate    | Same: unreachable selector, hardcoded hex/rgba.                                                                                                                                                                                            | Delete with the block above.                                                                                       |
| `ModernSplitDiff.scss:82-88` | `.header-stats { font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; flex-shrink:0; }` base | keep with reason | This base selector IS still applied (the badge container gets `className="header-stats"`); it supplies the 11px sizing the `plain` variant lacks (see `DiffStatsBadge.md` D5). Note `font-weight:600` overrides the badge's `font-medium`. | Keep base; but see D5 sweep candidate in DiffStatsBadge.md — sizing ideally lives in the component, not this SCSS. |

## Visual change (intended vs incidental)

- **Tinted pill background lost.** Before: additions/deletions rendered as a ~12% tinted
  green/red rounded pill (`background: rgba(...)` + `border-radius` + `padding`). After: the
  `.header-stats` base keeps `padding: 2px 8px` and `border-radius: 4px` but has **no
  background**, so it is now padded plain text in token color, not a pill.
- **Color source shifted** from hardcoded GitHub hex (`#2ea043` / `#f85149`) to design tokens
  (`text-success-6` / `text-danger-6`) — a token-consistency improvement.
- **Verdict on the regression:** the pill-removal is **intentional design-wide**, evidenced by
  the _clean_ removal of the equivalent rules in the other two stylesheets. `ModernSplitDiff` is
  simply an **incomplete cleanup**, not a deliberate divergence. Therefore: keep the new
  no-pill look (consistent with `index.scss` + `GitHubDiff`), and fix `ModernSplitDiff` by
  deleting the two orphaned nested rules so it matches.

## Systematic Sweep Discipline note

This is **not** a per-site whack-a-mole: the underlying class is "diff-stat pill background",
swept across all three stylesheets that owned it. The fix is a single, scoped cleanup (delete the
two dead nested selectors in `ModernSplitDiff.scss`) that brings the third file in line with the
two already-cleaned ones — config/intent-level consistency, decided once.

## Summary

- **fix:** 2 (orphaned `.header-stats.additions` / `.header-stats.deletions`)
- **keep with reason:** 1 (`.header-stats` base — still applied, supplies 11px sizing)
- **clean / no action:** 2 stylesheets already correctly cleaned
- **abstract / sweep candidate:** 0 here (the badge-sizing sweep lives in `DiffStatsBadge.md` D5)
