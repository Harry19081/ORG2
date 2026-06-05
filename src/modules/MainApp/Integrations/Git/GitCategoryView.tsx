import React from "react";

import type { DetailMode } from "../types";
import { GitTable } from "./Table/GitTable";

interface GitCategoryViewProps {
  selectedProvider: string | null;
  onSelectProvider: (provider: string | null, mode?: DetailMode) => void;
}

export const GitCategoryView: React.FC<GitCategoryViewProps> = ({
  selectedProvider,
  onSelectProvider,
}) => {
  return (
    <GitTable
      selectedRowId={selectedProvider}
      onSelectProvider={onSelectProvider}
    />
  );
};
