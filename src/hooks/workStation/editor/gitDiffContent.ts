import type { GitFileDiffResult } from "@src/api/http/git";
import { getGitBatchFileDiffs } from "@src/api/http/git/diff";
import type { GitFile } from "@src/types/git/types";
import { decodeOctalPath } from "@src/util/file/pathUtils";

const BINARY_DIFF_SENTINEL = "Binary file - content not displayed";

export function mergeGitFileDiff(
  file: GitFile,
  diff: GitFileDiffResult
): GitFile {
  if (diff.binary) {
    return {
      ...file,
      oldContent: BINARY_DIFF_SENTINEL,
      newContent: BINARY_DIFF_SENTINEL,
      additions: 0,
      deletions: 0,
    };
  }

  return {
    ...file,
    oldContent: diff.old_content ?? "",
    newContent: diff.new_content ?? "",
    additions: diff.insertions || 0,
    deletions: diff.deletions || 0,
  };
}

interface LoadGitFileDiffContentParams {
  repoPath: string;
  file: GitFile;
  relativePath: string;
}

export async function loadGitFileDiffContent({
  repoPath,
  file,
  relativePath,
}: LoadGitFileDiffContentParams): Promise<GitFile | null> {
  const response = await getGitBatchFileDiffs({
    repo_id: repoPath,
    repo_path: repoPath,
    files: [
      {
        path: relativePath,
        original_path: file.original_path ?? undefined,
      },
    ],
    from_ref: "HEAD",
    include_content: true,
    context_lines: 3,
  });

  const diff = response?.files.find(
    (item) => decodeOctalPath(item.file_path) === relativePath
  );

  if (!diff) return null;

  return mergeGitFileDiff(
    { ...file, path: relativePath, repoRoot: repoPath },
    diff
  );
}
