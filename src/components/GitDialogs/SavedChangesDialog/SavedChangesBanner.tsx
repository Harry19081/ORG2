import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { branchSwitchApi } from "@src/api/http/git/branchSwitch";
import Button from "@src/components/Button";

import { openSavedChanges } from "./index";

export function SavedChangesBanner({
  repoPath,
  branch,
  onRefresh,
}: {
  repoPath?: string;
  branch?: string;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation("common");
  const [loaded, setLoaded] = useState<{
    path: string;
    branch?: string;
    available: boolean;
  }>();
  useEffect(() => {
    if (!repoPath) return;
    let alive = true;
    let pending = false;
    let invalidated = false;
    const refresh = async () => {
      invalidated = true;
      if (pending || !alive || document.visibilityState === "hidden") return;
      invalidated = false;
      pending = true;
      try {
        const available = await branchSwitchApi.available(
          { repoId: repoPath, repoPath },
          branch || ""
        );
        if (alive && !invalidated)
          setLoaded({ path: repoPath, branch, available });
      } catch {
        if (alive && !invalidated)
          setLoaded({ path: repoPath, branch, available: false });
      } finally {
        pending = false;
        if (alive && invalidated) void refresh();
      }
    };
    const onChange = (event: Event) => {
      const scope = (event as CustomEvent).detail;
      if (!scope || scope.repoPath === repoPath) {
        onRefresh?.();
        void refresh();
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    void refresh();
    window.addEventListener("orgii-branch-switch-completed", onChange);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener("orgii-branch-switch-completed", onChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [repoPath, branch, onRefresh]);
  if (!repoPath) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      {loaded?.path === repoPath &&
        loaded.branch === branch &&
        loaded.available && (
          <span role="status" className="text-xs text-text-2">
            {t(
              "git.branchSwitch.savedAvailable",
              "Saved changes available for this branch"
            )}
          </span>
        )}
      <Button
        size="inline"
        appearance="ghost"
        onClick={() => openSavedChanges({ repoId: repoPath, repoPath })}
      >
        {t("git.branchSwitch.viewSaved", "View saved changes")}
      </Button>
    </div>
  );
}
