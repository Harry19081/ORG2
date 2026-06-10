import type { SessionReplayPlaceholderMode } from "@src/modules/WorkStation/shared";

import type {
  CodePanelMode,
  ExploreOperationEntry,
  FileOperationEntry,
  ShellOperationEntry,
  ToolOperationEntry,
} from "../types";

export interface CodePanelProps {
  operation: FileOperationEntry | null;
  exploreOperation?: ExploreOperationEntry | null;
  shellOperation?: ShellOperationEntry | null;
  toolOperation?: ToolOperationEntry | null;
  mode?: CodePanelMode;
  /** When `"simulation"` (default), empty-state placeholders omit layout shortcut hints. */
  sessionReplayMode?: SessionReplayPlaceholderMode;
  /**
   * When true, the current event is still running. Empty-operation states
   * render a loading skeleton instead of the idle NoTabsPlaceholder.
   */
  isLoading?: boolean;
}

export interface PreviewModeState {
  filePath: string;
  active: boolean;
}
