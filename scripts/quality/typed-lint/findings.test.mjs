import assert from "node:assert/strict";
import test from "node:test";

import { collectFindings, newFindings } from "./findings.mjs";

const result = (source, line = 1) => [
  {
    filePath: "/repo/src/a.ts",
    source,
    messages: [
      {
        ruleId: "rule",
        message: "unhandled",
        line,
        column: 1,
        endLine: line,
        endColumn: 8,
      },
    ],
  },
];
test("line movement preserves identity, a changed expression does not", () => {
  const baseline = collectFindings(result("send();"), "/repo");
  assert.deepEqual(
    newFindings(collectFindings(result("\nsend();", 2), "/repo"), baseline),
    []
  );
  assert.equal(
    newFindings(collectFindings(result("next();"), "/repo"), baseline).length,
    1
  );
});
test("duplicate findings cannot spend the same baseline allowance twice", () => {
  const baseline = collectFindings(result("send();"), "/repo");
  const doubled = collectFindings(
    [...result("send();"), ...result("send();")],
    "/repo"
  );
  assert.equal(newFindings(doubled, baseline).length, 1);
  assert.deepEqual(newFindings([], baseline), []);
  assert.throws(() => newFindings([], [...baseline, ...baseline]));
});
test("parser/configuration failures cannot be baselined", () => {
  assert.throws(() =>
    collectFindings(
      [
        {
          filePath: "bad",
          messages: [{ fatal: true, message: "parse failed" }],
        },
      ],
      "/repo"
    )
  );
});
