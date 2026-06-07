import { invoke } from "@tauri-apps/api/core";

export async function generateCommitMessage(repoPath: string): Promise<string> {
  return invoke<string>("generate_commit_message", { repoPath });
}
