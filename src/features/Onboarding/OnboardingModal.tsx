import React from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";

import onboardingImage from "@src/assets/illustrations/onboarding.png";
import ActionCard from "@src/components/ActionCard";
import Illustration from "@src/components/Illustration";
import Modal from "@src/scaffold/ModalSystem";
import { GUIDE_TARGETS } from "@src/scaffold/Tutorials/guideTargets";
import { TUTORIALS } from "@src/scaffold/Tutorials/tutorialRegistry";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

/** Optional discovery cards. Product actions retain their existing state owners. */
export default function OnboardingModal({
  open,
  onClose,
}: OnboardingModalProps) {
  const { t } = useTranslation("onboarding");
  const runAction = (action: () => void) => {
    // Release the focus trap and native overlay before a card opens its destination.
    flushSync(onClose);
    action();
  };

  return (
    <Modal
      visible={open}
      onCancel={onClose}
      title={t("discovery.title")}
      headerMedia={
        <Illustration src={onboardingImage} className="liquid-modal-image" />
      }
      footer={null}
      width={720}
    >
      <div
        className="flex flex-col gap-6"
        data-guide-target={GUIDE_TARGETS.TUTORIALS_MODAL}
        data-testid="onboarding-modal"
      >
        <section
          aria-labelledby="onboarding-start-title"
          className="flex flex-col gap-3"
        >
          <h2
            id="onboarding-start-title"
            className="text-sm font-semibold text-text-1"
          >
            {t("discovery.getStarted")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TUTORIALS.map((tutorial) => (
              <ActionCard
                key={tutorial.id}
                title={t(tutorial.titleKey)}
                description={t(tutorial.descriptionKey)}
                badge={t(tutorial.durationKey)}
                onClick={() =>
                  runAction(() =>
                    window.dispatchEvent(new CustomEvent(tutorial.eventName))
                  )
                }
                showArrow
                dataTestId={`onboarding-tour-${tutorial.id}`}
              />
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}
