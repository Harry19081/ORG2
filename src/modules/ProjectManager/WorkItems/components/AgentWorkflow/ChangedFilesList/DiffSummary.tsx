import React from "react";

import DiffStatsBadge from "@src/components/DiffStatsBadge";
import { formatStatNumber } from "@src/shared/pr/formatStatNumber";

interface DiffSummaryProps {
  added: number;
  removed: number;
}

const DiffSummary: React.FC<DiffSummaryProps> = ({ added, removed }) => (
  <DiffStatsBadge
    additions={added}
    deletions={removed}
    variant="plain"
    size="xs"
    formatValue={formatStatNumber}
  />
);

export default DiffSummary;
