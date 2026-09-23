# CiPendingDot UI audit

| Line                      | Element                       | Verdict          | Reason                                                                                                            | Suggested change |
| ------------------------- | ----------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------- |
| `CiPendingDot.tsx:12`     | Pending dot container         | keep with reason | Centers the small dot in each caller's existing icon slot without changing row alignment.                         | None.            |
| `CiPendingDot.tsx:18`     | Breathing animation           | keep with reason | Reuses the existing gentle agent pulse and warning color token; reduced-motion users get a static dot.            | None.            |
| `CiCheckStateIcon.tsx:49` | Shared check state            | keep with reason | One shared indicator keeps the Checks tab, merge box, and checks panel consistent while preserving verdict icons. | None.            |
| `PrChecksTab.tsx:91`      | Initial checks loading status | keep with reason | A labeled status region makes the dot accessible while the first checks response loads.                           | None.            |

Verdict totals: **0 fix**, **4 keep with reason**, **0 abstract**.
