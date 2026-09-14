const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  MAX_LINES,
  countLines,
  findOversizedFiles,
  isCheckedSource,
  parseNullDelimitedPaths,
} = require("./check-changed-file-length.cjs");

const SCRIPT = path.join(__dirname, "check-changed-file-length.cjs");

function lines(count) {
  return Array.from(
    { length: count },
    (_, i) => `const line${i} = ${i};\n`
  ).join("");
}

function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "file-length-"));
  for (const [filePath, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, filePath)), { recursive: true });
    fs.writeFileSync(path.join(root, filePath), text);
  }
  return root;
}

function runCli(root, input, env = {}) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: root,
    input: Buffer.from(input),
    encoding: "utf8",
    env: { ...process.env, GITHUB_ACTIONS: "", ...env },
  });
}

test("a touched file over the limit fails; a file exactly at the limit passes", () => {
  const root = makeTree({
    "src/long.tsx": lines(MAX_LINES + 1),
    "src/edge.ts": lines(MAX_LINES),
    "src/short.ts": lines(3),
  });

  assert.deepEqual(
    findOversizedFiles(["src/long.tsx", "src/edge.ts", "src/short.ts"], {
      root,
    }),
    [{ filePath: "src/long.tsx", lines: MAX_LINES + 1 }]
  );
});

test("files the pull request does not touch are never judged", () => {
  // The whole point of scoping to the diff: an existing long file stays as it
  // is until a pull request edits it.
  const root = makeTree({
    "src/legacy.ts": lines(MAX_LINES * 2),
    "src/short.ts": lines(3),
  });

  assert.deepEqual(findOversizedFiles(["src/short.ts"], { root }), []);
});

test("lines are counted the way an editor numbers them", () => {
  assert.equal(countLines(""), 0);
  assert.equal(countLines("a"), 1);
  assert.equal(countLines("a\n"), 1);
  assert.equal(countLines("a\nb"), 2);
  assert.equal(countLines("a\r\nb\r\n"), 2);
  assert.equal(countLines("\n"), 1);
});

test("test code and vendored code are exempt", () => {
  for (const exempt of [
    "src/store/chatPanel/__tests__/chatPanelTabsAtom.test.ts",
    "src/engines/ChatPanel/panels/ProjectPanelView.test.tsx",
    "src/test/vitest.setup.ts",
    "src/app/root/e2e/helpers/cloud.ts",
    "src/util/qr/qrcodeGeneratorVendor.js",
  ]) {
    assert.equal(isCheckedSource(exempt), false, exempt);
  }

  // The E2E exemption is the helper directory, not every file named after E2E.
  assert.equal(isCheckedSource("src/app/root/E2EBootstrap.tsx"), true);
  assert.equal(isCheckedSource("src/util/qr/buildQrCodeSvg.ts"), true);

  const root = makeTree({ "src/app/root/e2e/types.ts": lines(MAX_LINES + 50) });
  assert.deepEqual(
    findOversizedFiles(["src/app/root/e2e/types.ts"], { root }),
    []
  );
});

test("paths outside the frontend source tree are ignored", () => {
  for (const ignored of [
    "scripts/ci/pr-policy.cjs",
    "src-tauri/src/lib.rs",
    "src/styles/_utilities.scss",
    "src/i18n/locales/en/sessions.json",
    "docs/frontend-ui-audit-2026-08-28/GLOBAL.md",
  ]) {
    assert.equal(isCheckedSource(ignored), false, ignored);
  }
  assert.equal(isCheckedSource("src/scripts/legacy.jsx"), true);
});

test("a listed file missing from the checkout fails loudly", () => {
  const root = makeTree({});
  assert.throws(() => findOversizedFiles(["src/gone.ts"], { root }), /ENOENT/);
});

test("NUL-delimited paths preserve whitespace", () => {
  assert.deepEqual(
    parseNullDelimitedPaths(Buffer.from("src/a file.tsx\0docs/notes.md\0")),
    ["src/a file.tsx", "docs/notes.md"]
  );
});

test("the CLI exits non-zero and names each oversized file", () => {
  const root = makeTree({
    "src/long.tsx": lines(MAX_LINES + 12),
    "src/short.ts": lines(3),
  });

  const result = runCli(root, "src/long.tsx\0src/short.ts\0");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /src\/long\.tsx\s+712 lines/);
  assert.doesNotMatch(result.stderr, /short/);
  assert.equal(result.stdout, "");

  const annotated = runCli(root, "src/long.tsx\0", { GITHUB_ACTIONS: "true" });
  assert.equal(annotated.status, 1);
  assert.match(
    annotated.stdout,
    /^::error file=src\/long\.tsx,line=701,title=File too long::/
  );
});

test("the CLI passes when nothing touched is over the limit, including an empty diff", () => {
  const root = makeTree({ "src/short.ts": lines(3) });

  const result = runCli(root, "src/short.ts\0docs/notes.md\0");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /1 changed source files checked/);

  assert.equal(runCli(root, "").status, 0);
});
