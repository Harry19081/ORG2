import { describe, expect, it } from "vitest";

import type { SessionEvent } from "@src/engines/SessionCore/core/types";

import {
  getReadFileName,
  getReadFilePath,
  getReadFilePathSummary,
} from "../readFileEventData";

function readFileEvent(
  id: string,
  args: Record<string, unknown>,
  result: Record<string, unknown> = {}
): SessionEvent {
  return {
    id,
    chunk_id: id,
    sessionId: "read-file-path-test",
    createdAt: new Date(0).toISOString(),
    functionName: "read_file",
    uiCanonical: "read_file",
    actionType: "tool_call",
    args,
    result,
    source: "assistant",
    displayText: "read file",
    displayStatus: "completed",
    displayVariant: "tool_call",
    activityStatus: "agent",
    isDelta: false,
  } as SessionEvent;
}

describe("readFileEventData", () => {
  it("extracts paths from canonical snake/camel args and nested result payloads", () => {
    const events = [
      readFileEvent("snake", {
        file_path: "/workspace/primary/src/index.tsx",
      }),
      readFileEvent("camel", {
        targetFile: "/workspace/secondary/src/index.tsx",
      }),
      readFileEvent(
        "result-success",
        {},
        {
          success: {
            filePath: "/workspace/tertiary/README.md",
          },
        }
      ),
      readFileEvent(
        "output-success",
        {},
        {
          output: {
            success: {
              target_file: "/workspace/quaternary/package.json",
            },
          },
        }
      ),
    ];

    expect(events.map(getReadFilePath)).toEqual([
      "/workspace/primary/src/index.tsx",
      "/workspace/secondary/src/index.tsx",
      "/workspace/tertiary/README.md",
      "/workspace/quaternary/package.json",
    ]);
    expect(getReadFileName(events[1])).toBe("index.tsx");
    expect(getReadFilePathSummary(events)).toBe(
      "/workspace/primary/src/index.tsx · /workspace/secondary/src/index.tsx · /workspace/tertiary/README.md +1"
    );
  });

  it("falls back to file_name only after path keys are absent", () => {
    expect(
      getReadFilePath(
        readFileEvent("fallback-name", { file_name: "README.md" })
      )
    ).toBe("README.md");
    expect(
      getReadFilePath(
        readFileEvent("path-wins", {
          filePath: "/workspace/primary/README.md",
          file_name: "README.md",
        })
      )
    ).toBe("/workspace/primary/README.md");
  });
});
