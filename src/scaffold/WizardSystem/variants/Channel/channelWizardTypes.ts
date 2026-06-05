export const SERVICE_TYPES = [
  { type: "smithery", labelKey: "services.smithery" },
] as const;

export const PROJECT_ADAPTER_TYPES = [
  { type: "github", labelKey: "gitConnections.github" },
  { type: "linear", labelKey: "projectConnections.linear" },
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number]["type"];
export type ProjectSyncAdapterType =
  (typeof PROJECT_ADAPTER_TYPES)[number]["type"];

// Auth methods used by project connections. GitHub supports scan / OAuth /
// PAT / SSH; Linear supports OAuth / PAT.
export const STORY_SYNC_AUTH_METHODS = {
  PAT: "pat",
  OAUTH: "oauth",
  SCAN: "scan",
  SSH: "ssh",
} as const;

export type ProjectSyncAuthMethod =
  (typeof STORY_SYNC_AUTH_METHODS)[keyof typeof STORY_SYNC_AUTH_METHODS];

export type WizardCategory = "channels" | "services" | "projects";

export const SERVICE_CONFIG: Record<
  ServiceType,
  { labelKey: string; placeholderKey: string; descriptionKey: string }
> = {
  smithery: {
    labelKey: "services.smitheryApiKey",
    placeholderKey: "services.smitheryApiKeyPlaceholder",
    descriptionKey: "services.smitheryApiKeyDesc",
  },
};
