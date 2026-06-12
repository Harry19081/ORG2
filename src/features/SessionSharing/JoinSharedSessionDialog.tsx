import { useSetAtom } from "jotai";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import InlineAlert from "@src/components/InlineAlert";
import Input from "@src/components/Input";
import Textarea from "@src/components/Textarea";
import { useSessionView } from "@src/hooks/ui/tabs/useSessionView";
import Modal from "@src/scaffold/ModalSystem";

import {
  type GuestSessionShareConnection,
  joinSharedSession,
} from "./guestIngestion";
import { activeGuestShareConnectionsAtom } from "./state";
import { decodeShareOffer } from "./webrtc";

interface JoinSharedSessionDialogProps {
  onClose: () => void;
}

export const JoinSharedSessionDialog: React.FC<
  JoinSharedSessionDialogProps
> = ({ onClose }) => {
  const { t } = useTranslation("sessions");
  const { openSession } = useSessionView();
  const setActiveGuestShareConnections = useSetAtom(
    activeGuestShareConnectionsAtom
  );
  const [offerCode, setOfferCode] = useState("");
  const [pin, setPin] = useState("");
  const [connection, setConnection] =
    useState<GuestSessionShareConnection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    setError(null);
    try {
      const offer = await decodeShareOffer(offerCode.trim(), pin);
      const nextConnection = await joinSharedSession({
        offerCode: offerCode.trim(),
        pin,
        sourceSessionId: offer.sourceSessionId,
        shareId: offer.shareId,
      });
      setConnection(nextConnection);
      setActiveGuestShareConnections((current) => ({
        ...current,
        [nextConnection.localSessionId]: nextConnection,
      }));
      nextConnection.authenticated
        .then(() => openSession(nextConnection.localSessionId))
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      visible
      title={t("sharing.joinDialogTitle")}
      onCancel={handleClose}
      footer={null}
      width={640}
      bodyClassName="p-4"
    >
      <div className="space-y-4">
        <p className="text-sm text-text-2">
          {t("sharing.joinDialogDescription")}
        </p>

        <label className="block space-y-1.5 text-sm text-text-1">
          <span>{t("sharing.offerCodeLabel")}</span>
          <Textarea
            value={offerCode}
            onChange={setOfferCode}
            resize="none"
            rows={4}
            autoFocus
          />
        </label>

        <label className="block space-y-1.5 text-sm text-text-1">
          <span>{t("sharing.pinLabel")}</span>
          <Input value={pin} onChange={setPin} inputMode="numeric" />
        </label>

        <Button
          variant="primary"
          onClick={() => void handleJoin()}
          disabled={!offerCode.trim() || !pin.trim() || Boolean(connection)}
        >
          {t("sharing.joinSharedSession")}
        </Button>

        {connection && (
          <label className="block space-y-1.5 text-sm text-text-1">
            <span>{t("sharing.answerCodeLabel")}</span>
            <Textarea
              readOnly
              resize="none"
              rows={3}
              value={connection.answerCode}
            />
          </label>
        )}

        {error && <InlineAlert type="danger">{error}</InlineAlert>}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={handleClose}>
            {t("common:actions.close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
