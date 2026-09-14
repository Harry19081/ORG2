/**
 * Renderer wrapper for `git-stash-detail` tabs.
 *
 * Uses the shared commit detail header and diff controls.
 */
import React, { Suspense, memo } from "react";

import { Placeholder } from "@src/components/Placeholder";
import { useEditorHostContext } from "@src/modules/WorkStation/CodeEditor/Panels/EditorMainPane/context/editorHostContext";

import type { UnifiedTabContentProps } from "../types";

const GitCommitDetailContent = React.lazy(
  () =>
    import("@src/modules/WorkStation/CodeEditor/Panels/EditorMainPane/content/GitCommitDetailContent")
);

const LazyFallback = () => (
  <Placeholder variant="loading" placement="detail-panel" fillParentHeight />
);

const GitStashDetailTabRenderer: React.FC<UnifiedTabContentProps> = memo(
  ({ tab }) => {
    const { repoPath, repoId, onFileSelect } = useEditorHostContext();

    const commitSha = String(tab.data.commitSha || "");
    const commitShortSha = String(tab.data.shortSha || "");
    const commitMsg = String(tab.data.commitMessage || "");
    const resolvedRepoId = repoId ?? repoPath;
    const repoReady = Boolean(repoPath && resolvedRepoId);

    return (
      <Suspense fallback={<LazyFallback />}>
        <GitCommitDetailContent
          commitSha={commitSha}
          shortSha={commitShortSha}
          commitMessage={commitMsg}
          repoPath={repoPath}
          repoId={resolvedRepoId}
          isRepoReady={repoReady}
          onFileSelect={onFileSelect}
        />
      </Suspense>
    );
  }
);

GitStashDetailTabRenderer.displayName = "GitStashDetailTabRenderer";

export default GitStashDetailTabRenderer;
