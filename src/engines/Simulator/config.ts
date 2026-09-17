/**
 * ActivitySimulator Configuration
 *
 * Configuration for the activity simulator grid layout and icons
 */
import {
  Activity01Icon,
  ArrowDown01Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Clock01Icon,
  DashboardSquare01Icon,
  DatabaseIcon,
  FlashIcon,
  Forward01Icon,
  type IconSvgElement,
  LayoutListIcon,
  LockIcon,
  MonitorIcon,
  PauseIcon,
  PlayIcon,
  RewindIcon,
  Search01Icon,
  Settings01Icon,
  SkipBackIcon,
  SquareIcon,
} from "@src/icons";
import { SimulatorGridLayout } from "@src/store/ui/simulatorAtom";

// Layout configuration
export interface LayoutConfig {
  rows: number;
  cols: number;
  label: string;
}

// Re-export the type
export type GridLayout = SimulatorGridLayout;

// Icon configuration - hugeicons glyph data
export const ICON_CONFIG: Record<string, IconSvgElement> = {
  // Grid layout icons
  grid1x1: LayoutListIcon,
  grid1x2: LayoutListIcon,
  grid2x1: LayoutListIcon,
  grid2x2: DashboardSquare01Icon,
  grid2x3: DashboardSquare01Icon,
  // General icons
  settings: Settings01Icon,
  computer: MonitorIcon,
  activity: Activity01Icon,
  // Event switching icons
  event: FlashIcon,
  selector: Search01Icon,
  cycle: ArrowRight02Icon,
  search: Search01Icon,
  dropdown: ArrowDown01Icon,
  // Overview icons
  overview: DashboardSquare01Icon,
  // Browser navigation icons
  browser: MonitorIcon,
  lock: LockIcon,
  back: ArrowLeft02Icon,
  forward: ArrowRight02Icon,
  // Replay control icons
  play: PlayIcon,
  pause: PauseIcon,
  skipBack: SkipBackIcon,
  skipForward: Forward01Icon,
  rewind: RewindIcon,
  fastForward: Forward01Icon,
  time: Clock01Icon,
  // Data source icons
  live: SquareIcon,
  mock: DatabaseIcon,
};

// Layout options configuration
export const LAYOUT_OPTIONS: Record<SimulatorGridLayout, LayoutConfig> = {
  "1x1": { rows: 1, cols: 1, label: "Single" },
  "1x2": { rows: 1, cols: 2, label: "Side by Side" },
  "2x1": { rows: 2, cols: 1, label: "Stacked" },
  "2x2": { rows: 2, cols: 2, label: "Quad" },
  "2x3": { rows: 3, cols: 2, label: "Six Pack" },
  "3x3": { rows: 3, cols: 3, label: "Nine Grid" },
  "4x2": { rows: 2, cols: 4, label: "Eight Wide" },
  "3x4": { rows: 4, cols: 3, label: "Twelve Grid" },
};

/**
 * Calculate optimal grid layout based on task count
 * Tries to create a balanced grid that fits all tasks
 */
export function calculateAutoLayout(taskCount: number): SimulatorGridLayout {
  if (taskCount <= 1) return "1x1";
  if (taskCount === 2) return "1x2";
  if (taskCount === 3) return "2x2"; // 3 tasks in 2x2, one empty
  if (taskCount === 4) return "2x2";
  if (taskCount <= 6) return "2x3";
  if (taskCount <= 8) return "4x2";
  if (taskCount <= 9) return "3x3";
  return "3x4"; // Up to 12 tasks
}

// Default configuration

// Note: Replay configuration is centralized in:
// Shared config with @src/config/workspace/replayConfig.ts

/**
 * Agent focus dot tokens — the pulsing blue dot that shows
 * where the agent is currently working.
 *
 * Two sizes:
 * - standard (6px): sidebar items, unpinned dock apps
 * - small (4px): pinned dock apps
 */
export const AGENT_DOT_TOKENS = {
  container: "flex h-4 w-4 shrink-0 items-center justify-center",
  dot: "h-[6px] w-[6px] animate-pulse rounded-full bg-primary-6",
  containerSmall: "flex h-[4px] w-[4px] items-center justify-center",
  dotSmall: "h-[4px] w-[4px] animate-pulse rounded-full bg-primary-6",
} as const;

// Style configuration
export const STYLE_CONFIG = {
  headerHeight: "32px",
  gridGap: "12px",
  computerRadius: "12px",
  browserHeaderHeight: "40px",
};

// Get total cells for a layout
export const getLayoutCells = (layout: SimulatorGridLayout): number => {
  const config = LAYOUT_OPTIONS[layout];
  return config.rows * config.cols;
};

// Get grid icon for layout

// Get icon for event type
