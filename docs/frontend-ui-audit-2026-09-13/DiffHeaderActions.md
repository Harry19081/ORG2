# DiffHeaderActions UI audit

| Line                                                           | Element                  | Verdict          | Reason                                                                                                                                                                    | Suggested change |
| -------------------------------------------------------------- | ------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `src/modules/WorkStation/shared/DiffFileSection/index.tsx:443` | Plain filename           | keep with reason | Navigation is now an explicit action; text clicks still reach the header disclosure                                                                                       | None             |
| `src/modules/WorkStation/shared/DiffFileSection/index.tsx:465` | Copy/open action group   | keep with reason | Shared Button soft appearance, small size, header icon token and 1px spacing; zero-width wrapper and compensated gap avoid reserved space; keyboard focus reveals actions | None             |
| `src/modules/WorkStation/shared/DiffFileSection/index.tsx:506` | Disclosure/count control | keep with reason | Custom shared Button preserves compound tooltip children and overlay geometry; screen-reader labels remain after removing native title tooltip                            | None             |
| `src/modules/WorkStation/shared/DiffSectionList/index.tsx:375` | Diff canvas              | keep with reason | Existing editor canvas token aligns virtualized container and headers                                                                                                     | None             |

Verdict totals: **0 fix**, **4 keep with reason**, **0 abstract**.

Source review: new action controls use shared Button; custom geometry is documented in reusable primitives. Native UI screenshots were not captured because computer control was not requested. Verification commands and outcomes are recorded in the PR.
