import type { useWorkstationPrDetail } from "../../../hooks/useWorkstationPrDetail";

/** Mutations, picker candidates and pending flags for the mounted PR. */
export type WorkstationPrDetailController = ReturnType<
  typeof useWorkstationPrDetail
>;
