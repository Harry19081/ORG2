import React from "react";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import PageNotice from "@src/components/PageNotice";
import { Placeholder } from "@src/components/Placeholder";
import StatusDot from "@src/components/StatusDot";
import { SectionContainer, SectionRow } from "@src/components/layout/Section";
import { HugeiconsIcon, LaptopIcon, SmartPhone01Icon } from "@src/icons";

import { useMobileRemote } from "../../app";
import { MobileTopBar } from "../../components/MobileTopBar";
import { derivePairedDesktopPresence } from "../../connection/mobilePairedDesktopPresence";
import { resolvePermissionTierLabel } from "../../connection/mobilePermissionPresentation";
import type { DesktopPresence } from "../../connection/types";

function resolveDotColor(presence: DesktopPresence): string {
  switch (presence) {
    case "online":
      return "bg-success-6";
    case "offline":
      return "bg-text-4";
    default:
      return "bg-text-4";
  }
}

function resolvePresenceLabel(
  presence: DesktopPresence,
  t: (key: string) => string
): string {
  switch (presence) {
    case "online":
      return t("devices.online");
    case "offline":
      return t("devices.offline");
    default:
      return t("devices.unknown");
  }
}

/** Settings destination; the provider remains the owner of device selection. */
export function ConnectionDevicesScreen({
  onBack,
  onAddDesktop,
}: {
  onBack: () => void;
  onAddDesktop: () => void;
}) {
  const { t } = useTranslation("mobileRemote");
  const [switchingDesktopId, setSwitchingDesktopId] = React.useState<
    string | null
  >(null);
  const [switchError, setSwitchError] = React.useState<string | null>(null);
  const {
    connection,
    pairedDesktops: pairedDesktopInventory,
    switchPairedDesktop,
  } = useMobileRemote();
  const pairedDesktops = derivePairedDesktopPresence({
    desktops: pairedDesktopInventory,
    activePresence: connection.presence,
  });

  return (
    <>
      <MobileTopBar
        title={t("settings.connectionDevices")}
        onBack={onBack}
        backAriaLabel={t("settings.back")}
      />
      <div className="mobile-flow-screen flex-1 px-4 py-4">
        <div className="flex flex-col gap-5">
          <SectionContainer
            titleSlot={
              <span className="mobile-type-secondary font-semibold text-text-1">
                {t("devices.thisDevice")}
              </span>
            }
            dataTestId="mobile-remote-this-device"
          >
            <SectionRow
              layout="inline"
              label={
                <span className="mobile-type-body flex min-w-0 items-center gap-2">
                  <HugeiconsIcon
                    icon={SmartPhone01Icon}
                    size={16}
                    className="shrink-0 text-text-3"
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    {t("devices.thisDeviceLabel")}
                  </span>
                </span>
              }
            >
              <span className="mobile-type-caption block max-w-full min-w-0 truncate text-right text-text-3">
                {resolvePermissionTierLabel(connection.tier, t)}
              </span>
            </SectionRow>
          </SectionContainer>

          <SectionContainer
            titleSlot={
              <span className="mobile-type-secondary font-semibold text-text-1">
                {t("devices.pairedDesktops")}
              </span>
            }
            padding={pairedDesktops.length === 0 ? "default" : "none"}
            dataTestId="mobile-remote-paired-desktops"
          >
            {pairedDesktops.length === 0 ? (
              <Placeholder
                titleClassName="mobile-type-heading"
                subtitleClassName="mobile-type-secondary"
                variant="empty"
                title={t("devices.emptyDesktops")}
                className="py-6"
              />
            ) : (
              <>
                {pairedDesktops.map((desktop) => (
                  <SectionRow
                    key={desktop.id}
                    layout="inline"
                    className="py-1"
                    label={
                      desktop.current ? (
                        <span
                          aria-current="true"
                          className="mobile-type-body flex min-h-11 min-w-0 items-center gap-2 text-text-1"
                        >
                          <HugeiconsIcon
                            icon={LaptopIcon}
                            size={16}
                            className="shrink-0 text-text-3"
                            aria-hidden="true"
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="break-words">{desktop.name}</span>
                            {desktop.details ? (
                              <span className="mobile-type-caption font-normal break-words text-text-3">
                                {desktop.details}
                              </span>
                            ) : null}
                            <span className="mobile-type-caption font-normal text-text-3">
                              {t("devices.currentDesktop")}
                            </span>
                          </span>
                        </span>
                      ) : (
                        <Button
                          variant="tertiary"
                          appearance="ghost"
                          long
                          className="min-w-0 justify-start text-left disabled:cursor-default"
                          style={{
                            height: "auto",
                            minHeight: "var(--mobile-touch-size)",
                            padding: "8px 0",
                            fontSize: "var(--mobile-type-control-size)",
                          }}
                          disabled={switchingDesktopId !== null}
                          loading={switchingDesktopId === desktop.id}
                          aria-busy={switchingDesktopId === desktop.id}
                          aria-label={t("devices.switchTo", {
                            name: desktop.name,
                          })}
                          icon={
                            <HugeiconsIcon
                              icon={LaptopIcon}
                              size={16}
                              className="shrink-0 text-text-3"
                              aria-hidden="true"
                            />
                          }
                          onClick={async () => {
                            setSwitchError(null);
                            setSwitchingDesktopId(desktop.id);
                            try {
                              await switchPairedDesktop(desktop.id);
                            } catch {
                              setSwitchError(t("devices.switchFailed"));
                            } finally {
                              setSwitchingDesktopId(null);
                            }
                          }}
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-1 whitespace-normal">
                            <span className="break-words">{desktop.name}</span>
                            {desktop.details ? (
                              <span className="mobile-type-caption font-normal break-words text-text-3">
                                {desktop.details}
                              </span>
                            ) : null}
                          </span>
                        </Button>
                      )
                    }
                  >
                    <StatusDot
                      color={resolveDotColor(desktop.presence)}
                      label={
                        desktop.current
                          ? resolvePresenceLabel(desktop.presence, t)
                          : t("devices.presenceUnknown")
                      }
                      size="inline"
                      labelClassName="mobile-type-caption font-medium text-text-1"
                    />
                  </SectionRow>
                ))}
                {switchError ? (
                  <SectionRow showHeader={false} compact>
                    <PageNotice
                      bodyClassName="mobile-type-secondary"
                      type="danger"
                      role="alert"
                      compact
                      className="w-full"
                    >
                      {switchError}
                    </PageNotice>
                  </SectionRow>
                ) : null}
              </>
            )}
          </SectionContainer>
          <Button
            variant="secondary"
            size="large"
            className="min-h-11"
            style={{ fontSize: "var(--mobile-type-control-size)" }}
            disabled={switchingDesktopId !== null}
            onClick={onAddDesktop}
          >
            {t("devices.addDesktop")}
          </Button>
        </div>
      </div>
    </>
  );
}

ConnectionDevicesScreen.displayName = "ConnectionDevicesScreen";
