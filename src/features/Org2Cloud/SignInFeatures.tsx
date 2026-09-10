import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import marketImage from "@src/assets/illustrations/login-market.png";
import mobileRemoteImage from "@src/assets/illustrations/login-mobile-remote.png";
import sharingImage from "@src/assets/illustrations/login-sharing.png";

const ROTATION_MS = 6000;

export function SignInFeatures() {
  const { t } = useTranslation(["navigation", "mobileRemote"]);
  const [index, setIndex] = useState(0);
  const slides = [
    {
      image: sharingImage,
      title: t("cloud.share.dialogTitle"),
      body: t("cloud.featureSharingBody"),
    },
    {
      image: marketImage,
      title: "ORG2 Market",
      body: t("cloud.featureMarketBody"),
    },
    {
      image: mobileRemoteImage,
      title: t("mobileRemote:welcome.title"),
      body: t("cloud.featureMobileRemoteBody"),
    },
  ];
  const slideCount = slides.length;

  useEffect(() => {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      clear();
      if (motion?.matches || document.visibilityState === "hidden") return;
      timer = setTimeout(() => {
        setIndex((current) => (current + 1) % slideCount);
        schedule();
      }, ROTATION_MS);
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    motion?.addEventListener("change", schedule);
    return () => {
      clear();
      document.removeEventListener("visibilitychange", schedule);
      motion?.removeEventListener("change", schedule);
    };
  }, [slideCount]);

  const slide = slides[index];
  return (
    <section
      aria-label={t("cloud.signInModalTitle")}
      className="relative shrink-0 overflow-hidden"
      aria-live="off"
    >
      <img
        src={slide.image}
        alt=""
        className="liquid-modal-image"
        draggable={false}
      />
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/60 to-transparent px-3 pt-12 pb-3">
        <h3 className="text-base font-semibold text-white">{slide.title}</h3>
        <p className="text-sm text-white/90">{slide.body}</p>
      </div>
    </section>
  );
}
