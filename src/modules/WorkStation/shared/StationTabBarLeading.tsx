import React from "react";

import { NoDragRegion } from "@src/components/WindowChrome";

import { StationModeChip } from "./StationModeChip";
import { TabBarLeadingLayout } from "./TabBarLeadingLayout";

interface StationTabBarLeadingProps {
  trailing?: React.ReactNode;
  trailingPadding?: boolean;
}

export const StationTabBarLeading: React.FC<StationTabBarLeadingProps> = ({
  trailing,
  trailingPadding,
}) => (
  <TabBarLeadingLayout trailingPadding={trailingPadding}>
    <NoDragRegion>
      <StationModeChip />
    </NoDragRegion>
    {trailing ? <NoDragRegion>{trailing}</NoDragRegion> : null}
  </TabBarLeadingLayout>
);

export default StationTabBarLeading;
