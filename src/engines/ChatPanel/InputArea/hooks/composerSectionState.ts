export type ComposerSecondarySection = "queue" | "process" | "files";
export type ComposerActiveSection = ComposerSecondarySection | null;

interface ResolveComposerSectionSwitchOptions {
  previousSessionId?: string | null;
  nextSessionId?: string | null;
  currentActiveSection: ComposerActiveSection;
  queueCount: number;
  previouslyStoredSection?: ComposerActiveSection;
}

interface ResolveComposerSectionSwitchResult {
  activeSection: ComposerActiveSection;
  storedSectionForPrevious: ComposerActiveSection | undefined;
}

export function resolveComposerSectionForSessionSwitch({
  previousSessionId,
  nextSessionId,
  currentActiveSection,
  queueCount,
  previouslyStoredSection,
}: ResolveComposerSectionSwitchOptions): ResolveComposerSectionSwitchResult {
  if (previousSessionId === nextSessionId) {
    return {
      activeSection: currentActiveSection,
      storedSectionForPrevious: undefined,
    };
  }

  const restoredSection =
    previouslyStoredSection !== undefined
      ? previouslyStoredSection
      : queueCount > 0
        ? "queue"
        : null;
  return {
    activeSection:
      restoredSection === "queue" && queueCount === 0 ? null : restoredSection,
    storedSectionForPrevious: currentActiveSection,
  };
}
