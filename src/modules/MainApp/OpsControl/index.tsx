/**
 * Ops Control pane
 *
 * Reuses the existing `TaskKanban` feature to give a single board view of
 * agent status inside Workstation.
 */
import { useAtomValue } from "jotai";
import React from "react";

import TaskKanban from "@src/features/TaskKanban";
import { usePrimarySidebarState } from "@src/hooks/workStation/panels/useWorkStationPanels";
import {
  WorkStationShell,
  buildPrimarySidebarConfig,
} from "@src/modules/WorkStation/shared";
import {
  OPS_CONTROL_HOME_TAB,
  opsControlHomeTabAtom,
} from "@src/store/workstation";

import OpsControlProjectsSurface from "./OpsControlProjectsSurface";
import OpsControlSidebar from "./OpsControlSidebar";
import OpsControlTaskCreator from "./OpsControlTaskCreator";
import "./index.scss";

function buildOpsControlSidebarConfig({
  collapsed,
  size,
  onSizeChange,
  onClose,
}: {
  collapsed: boolean;
  size: number;
  onSizeChange: (size: number) => void;
  onClose: () => void;
}) {
  return buildPrimarySidebarConfig({
    content: <OpsControlSidebar />,
    collapsed,
    size,
    onSizeChange,
    onClose,
  });
}

const OpsControlPage: React.FC = () => {
  const {
    primarySidebarCollapsed,
    primarySidebarWidth,
    setPrimarySidebarWidth,
    closePrimarySidebar,
  } = usePrimarySidebarState();
  const activeHomeTab = useAtomValue(opsControlHomeTabAtom);

  const mainContent = (
    <div className="ops-control-page flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {activeHomeTab === OPS_CONTROL_HOME_TAB.PROJECTS ? (
          <OpsControlProjectsSurface />
        ) : (
          <>
            <TaskKanban />
            <OpsControlTaskCreator />
          </>
        )}
      </div>
    </div>
  );

  const primarySidebarConfig = buildOpsControlSidebarConfig({
    collapsed: primarySidebarCollapsed,
    size: primarySidebarWidth,
    onSizeChange: setPrimarySidebarWidth,
    onClose: closePrimarySidebar,
  });

  return (
    <WorkStationShell
      primarySidebarConfig={primarySidebarConfig}
      content={mainContent}
      statusBar={null}
      appClassName="ops-control-workstation"
    />
  );
};

export default OpsControlPage;
