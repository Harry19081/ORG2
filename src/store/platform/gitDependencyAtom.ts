import { invoke } from "@tauri-apps/api/core";
import { atom } from "jotai";

interface GitDependencyEntry {
  binary: "git";
  installed: boolean;
}

interface GitDependencyResult {
  dependency: GitDependencyEntry;
}

export const gitDependencyInstalledAtom = atom<boolean | null>(null);
gitDependencyInstalledAtom.debugLabel = "gitDependency/installed";

const gitDependencyLoadingAtom = atom(false);
gitDependencyLoadingAtom.debugLabel = "gitDependency/loading";

export const probeGitDependencyAtom = atom(null, async (get, set) => {
  if (get(gitDependencyLoadingAtom)) return;

  set(gitDependencyLoadingAtom, true);
  try {
    const result = await invoke<GitDependencyResult>("detect_git_dependency");
    set(gitDependencyInstalledAtom, result.dependency.installed);
  } finally {
    set(gitDependencyLoadingAtom, false);
  }
});
probeGitDependencyAtom.debugLabel = "gitDependency/probe";
