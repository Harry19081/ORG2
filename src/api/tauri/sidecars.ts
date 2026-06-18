import { invokeTauri } from "@src/util/platform/tauri/init";

export const OPTIONAL_SIDECAR = {
  AGENT_BROWSER: "agent_browser",
  PEEKABOO: "peekaboo",
} as const;

export type OptionalSidecar =
  (typeof OPTIONAL_SIDECAR)[keyof typeof OPTIONAL_SIDECAR];

export interface SidecarStatus {
  sidecar: OptionalSidecar;
  installed: boolean;
  supported: boolean;
  path: string | null;
}

export function listSidecarStatus(): Promise<SidecarStatus[]> {
  return invokeTauri<SidecarStatus[]>("sidecar_list_status");
}

export function installSidecar(
  sidecar: OptionalSidecar
): Promise<SidecarStatus> {
  return invokeTauri<SidecarStatus>("sidecar_install", { sidecar });
}

export async function ensureSidecarInstalled(
  sidecar: OptionalSidecar
): Promise<SidecarStatus> {
  const statuses = await listSidecarStatus();
  const status = statuses.find((entry) => entry.sidecar === sidecar);
  if (!status) {
    throw new Error(`Unknown sidecar: ${sidecar}`);
  }
  if (!status.supported) {
    throw new Error(`Sidecar is not supported on this platform: ${sidecar}`);
  }
  if (status.installed) {
    return status;
  }
  return installSidecar(sidecar);
}
