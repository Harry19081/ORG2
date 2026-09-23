# Textarea UI audit

| Line                     | Element              | Verdict          | Reason                                                                     | Suggested change |
| ------------------------ | -------------------- | ---------------- | -------------------------------------------------------------------------- | ---------------- |
| `Textarea/index.tsx:61`  | Shared size contract | keep with reason | Mini, small, and default cover the remaining multiline field callers.      | None.            |
| `Textarea/index.tsx:323` | Native textarea      | keep with reason | This is the shared Textarea primitive, which must render the native field. | None.            |

Verdict totals: **0 fix**, **2 keep with reason**, **0 abstract**.
