/**
 * Session Replay Types
 *
 * Shared types for session replay across different simulator apps
 * (ProjectManager, etc.)
 */
import type { AppSubtool } from "@src/engines/SessionCore/rendering/registry/types";

import type { SimulatorAppBaseState } from "./types";

// ============================================
// Base Operation Types
// ============================================

/**
 * Base operation type for session replay.
 * Extended by specific apps (ProjectOperation, etc.).
 */
export interface BaseOperation {
  /** Unique identifier (usually event_id) */
  eventId: string;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Operation type (app-specific or AppSubtool) */
  type: string | AppSubtool;
  /** Summary of the result for display */
  resultSummary: string;
  /** Whether this operation resulted in an error */
  isError: boolean;
  /** Whether this is the current operation in replay */
  isCurrent: boolean;
}

/**
 * Project operation for session replay.
 */
export interface ProjectOperation extends BaseOperation {
  type: "project" | AppSubtool;
  functionName: string;
  /** Action performed */
  action?: string;
  /** Tool args captured from the event */
  args: Record<string, unknown>;
  /** Text output captured from the tool result */
  resultText: string;
  /** Project name */
  projectName?: string;
  /** Work item title */
  workItemTitle?: string;
}

// ============================================
// Simulator State Types
// ============================================

/**
 * Simulator state for ProjectManager.
 */
export interface SimulatorProjectState extends SimulatorAppBaseState {
  operations: ProjectOperation[];
  selectedOperation: ProjectOperation | null;
}
