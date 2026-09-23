# Select UI audit

| Line                               | Element                 | Verdict          | Reason                                                                                  | Suggested change |
| ---------------------------------- | ----------------------- | ---------------- | --------------------------------------------------------------------------------------- | ---------------- |
| `Select/types.ts:33`               | Shared size contract    | keep with reason | Mini, small, and default cover the remaining Select and trigger callers.                | None.            |
| `Select/index.scss:70`             | Default trigger size    | keep with reason | The shared 32px selector matches default Input geometry.                                | None.            |
| `Select/SelectGhostTrigger.tsx:77` | Compound trigger layout | keep with reason | The reusable trigger uses shared Button and Select styling to match the control family. | None.            |

Verdict totals: **0 fix**, **3 keep with reason**, **0 abstract**.
