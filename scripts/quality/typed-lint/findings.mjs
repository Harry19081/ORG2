import { createHash } from "node:crypto";
import path from "node:path";

export function collectFindings(results, root) {
  const grouped = new Map();
  for (const result of results) {
    const lines = (result.source ?? "").split(/\r?\n/);
    for (const message of result.messages) {
      if (message.fatal || !message.ruleId) {
        throw new Error(
          `${result.filePath}:${message.line}: ${message.message}`
        );
      }
      const file = path
        .relative(root, result.filePath)
        .split(path.sep)
        .join("/");
      const selected = lines.slice(
        message.line - 1,
        message.endLine ?? message.line
      );
      if (selected.length) {
        selected[selected.length - 1] = selected
          .at(-1)
          .slice(0, message.endColumn ? message.endColumn - 1 : undefined);
        selected[0] = selected[0].slice(message.column - 1);
      }
      const source = selected.join("\n").replace(/\s+/g, " ").trim();
      const key = createHash("sha256")
        .update(JSON.stringify([file, message.ruleId, message.message, source]))
        .digest("hex");
      const finding = grouped.get(key) ?? {
        key,
        file,
        rule: message.ruleId,
        message: message.message,
        source,
        count: 0,
      };
      finding.count++;
      grouped.set(key, finding);
    }
  }
  return [...grouped.values()].sort(
    (a, b) => a.file.localeCompare(b.file) || a.key.localeCompare(b.key)
  );
}

export function newFindings(current, baseline) {
  if (!Array.isArray(baseline)) throw new Error("Baseline must be an array");
  const limits = new Map();
  for (const entry of baseline) {
    if (
      limits.has(entry.key) ||
      !Number.isSafeInteger(entry.count) ||
      entry.count < 1
    )
      throw new Error("Invalid or duplicate baseline entry");
    limits.set(entry.key, entry.count);
  }
  return current.filter((entry) => entry.count > (limits.get(entry.key) ?? 0));
}
