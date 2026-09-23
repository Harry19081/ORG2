# Input UI audit

| Line                  | Element              | Verdict          | Reason                                                                       | Suggested change |
| --------------------- | -------------------- | ---------------- | ---------------------------------------------------------------------------- | ---------------- |
| `Input/index.tsx:62`  | Shared size contract | keep with reason | Mini, small, and default cover the remaining call sites at 24, 28, and 32px. | None.            |
| `Input/index.scss:50` | Default field size   | keep with reason | Uses the shared 32px control size and existing design tokens.                | None.            |
| `Input/index.tsx:410` | Native input element | keep with reason | This is the shared Input primitive, which must render the native field.      | None.            |

Verdict totals: **0 fix**, **3 keep with reason**, **0 abstract**.
