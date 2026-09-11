/**
 * ImagePreviewOverlay
 *
 * Shared modal image viewer with separate header actions and gallery footer.
 * The modal owns focus, Escape, backdrop dismissal and overlay layering.
 */
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import Button from "@src/components/Button";
import Message from "@src/components/Message";
import Slider from "@src/components/Slider";
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Copy01Icon,
  Download01Icon,
  HugeiconsIcon,
  MinusSignIcon,
} from "@src/icons";
import { PANEL_HEADER_TOKENS } from "@src/modules/shared/layouts/blocks/PanelHeader";
import Modal from "@src/scaffold/ModalSystem";
import { releaseImageUrl } from "@src/util/file/binaryUtils";

import { useImagePinchZoom } from "./useImagePinchZoom";

// ============================================
// Types
// ============================================

interface ImagePreviewOverlayProps {
  dataUrl: string;
  /** Same-message attachments; only the selected image is resolved. */
  images?: { src: string; fileName?: string }[];
  initialIndex?: number;
  resolveImage?: (ref: string) => Promise<string>;
  fileName?: string;
  onClose: () => void;
  /** When false, hides the copy-to-clipboard control. Default true. */
  showCopyButton?: boolean;
}

// ============================================
// Component
// ============================================

const ImagePreviewOverlay: React.FC<ImagePreviewOverlayProps> = memo(
  ({
    dataUrl,
    fileName,
    onClose,
    showCopyButton = true,
    images,
    initialIndex = 0,
    resolveImage,
  }) => {
    const { t } = useTranslation("common");
    const imageRef = useRef<HTMLImageElement>(null);

    const viewportRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(100);
    const [index, setIndex] = useState(initialIndex);
    const [loaded, setLoaded] = useState<{
      index: number;
      src: string;
      failed?: boolean;
    } | null>(null);
    const currentSrc =
      index === initialIndex
        ? dataUrl
        : loaded?.index === index
          ? loaded.src
          : "";
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const currentName = images?.[index]?.fileName ?? fileName;
    const count = images?.length ?? 1;
    const failed = loaded?.index === index && loaded.failed;
    useImagePinchZoom(
      viewportRef,
      currentSrc && failedSrc !== currentSrc ? currentSrc : null,
      zoom,
      setZoom
    );

    useEffect(() => {
      if (index === initialIndex || !images || !resolveImage) return;
      let cancelled = false;
      let ownedUrl: string | null = null;
      setLoaded(null);
      const original = images[index].src;
      void resolveImage(original).then(
        (src) => {
          if (cancelled) {
            if (src !== original) releaseImageUrl(src);
            return;
          }
          ownedUrl = src !== original ? src : null;
          setLoaded({ index, src });
        },
        () => {
          if (!cancelled) setLoaded({ index, src: "", failed: true });
        }
      );
      return () => {
        cancelled = true;
        releaseImageUrl(ownedUrl);
      };
    }, [index, initialIndex, images, resolveImage]);

    const navigate = (next: number) => {
      const target = Math.max(0, Math.min(count - 1, next));
      if (target === index) return;
      setLoaded(null);
      setFailedSrc(null);
      setIndex(target);
      setZoom(100);
      if (viewportRef.current) {
        viewportRef.current.scrollTop = 0;
        viewportRef.current.scrollLeft = 0;
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, [role="slider"]'))
        return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        navigate(index + (event.key === "ArrowLeft" ? -1 : 1));
      }
    };

    const handleCopy = useCallback(async () => {
      try {
        const image = imageRef.current;
        if (!image?.complete || !image.naturalWidth || !image.naturalHeight) {
          throw new Error("Preview image is not ready");
        }
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image conversion is unavailable");
        context.drawImage(image, 0, 0);
        // PNG is the portable clipboard image format. Pass its promise directly
        // so clipboard.write runs within the click gesture, including on WebKit.
        const png = new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            canvas.width = canvas.height = 0;
            if (blob) resolve(blob);
            else reject(new Error("Image conversion failed"));
          }, "image/png");
        });
        // Also observe conversion failures if the clipboard API rejects early.
        void png.catch(() => {});
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": png }),
        ]);
        Message.success(t("imagePreview.copiedToClipboard"));
      } catch {
        Message.error(t("errors.failedToCopy"));
      }
    }, [t]);

    const handleDownload = useCallback(() => {
      const link = document.createElement("a");
      link.href = currentSrc;
      link.download = currentName || "image.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, [currentSrc, currentName]);

    const action = (
      label: string,
      icon: typeof Copy01Icon,
      onClick: () => void,
      disabled = false
    ) => (
      <Button
        {...PANEL_HEADER_TOKENS.actionButton}
        htmlType="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        disabled={disabled}
        icon={
          <HugeiconsIcon
            icon={icon}
            size={PANEL_HEADER_TOKENS.buttonIconSize}
            strokeWidth={PANEL_HEADER_TOKENS.iconStrokeWidth}
          />
        }
      />
    );

    return (
      <div onKeyDown={handleKeyDown}>
        <Modal
          visible
          onClose={onClose}
          title={currentName || t("imagePreview.dialogLabel")}
          aria-label={t("imagePreview.dialogLabel")}
          width={960}
          className="h-[80dvh] min-w-0!"
          bodyClassName="flex min-h-0 flex-1 items-center justify-center overflow-hidden! bg-fill-1 p-4"
          closable={false}
          headerActions={
            <>
              {showCopyButton &&
                action(
                  t("imagePreview.copyImage"),
                  Copy01Icon,
                  handleCopy,
                  !currentSrc || failedSrc === currentSrc
                )}
              {action(
                t("imagePreview.downloadImage"),
                Download01Icon,
                handleDownload,
                !currentSrc || failedSrc === currentSrc
              )}
              {action(t("imagePreview.closePreview"), Cancel01Icon, onClose)}
            </>
          }
          footer={
            <div className="flex shrink-0 justify-center bg-fill-1 px-3 pt-1 pb-3">
              <div className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full border border-border-2 bg-bg-2 px-2 py-1 shadow-sm">
                {count > 1 && (
                  <>
                    {action(
                      t("actions.previous"),
                      ArrowLeft01Icon,
                      () => navigate(index - 1),
                      index === 0
                    )}
                    <span
                      className="px-1 text-xs text-text-3 tabular-nums"
                      role="status"
                    >
                      {index + 1} / {count}
                    </span>
                    {action(
                      t("actions.next"),
                      ArrowRight01Icon,
                      () => navigate(index + 1),
                      index === count - 1
                    )}
                    <span
                      className="mx-1 h-4 w-px bg-border-2"
                      aria-hidden="true"
                    />
                  </>
                )}
                {action(
                  t("tooltips.zoomOut"),
                  MinusSignIcon,
                  () => setZoom((value) => Math.max(25, value - 25)),
                  zoom === 25 || !currentSrc || failedSrc === currentSrc
                )}
                <Slider
                  min={25}
                  max={400}
                  step={5}
                  value={zoom}
                  aria-label={t("tooltips.zoomIn")}
                  disabled={!currentSrc || failedSrc === currentSrc}
                  onValueChange={(value) => {
                    if (typeof value === "number") setZoom(value);
                  }}
                  formatTooltip={(value) => `${value}%`}
                  className="w-28!"
                  noPadding
                  handleBordered
                />
                {action(
                  t("tooltips.zoomIn"),
                  Add01Icon,
                  () => setZoom((value) => Math.min(400, value + 25)),
                  zoom === 400 || !currentSrc || failedSrc === currentSrc
                )}
                <Button
                  size="small"
                  variant="tertiary"
                  shape="round"
                  className="min-w-14 tabular-nums"
                  title={t("tooltips.resetZoom")}
                  aria-label={t("tooltips.resetZoom")}
                  disabled={!currentSrc || failedSrc === currentSrc}
                  onClick={() => {
                    setZoom(100);
                    if (viewportRef.current) {
                      viewportRef.current.scrollTop = 0;
                      viewportRef.current.scrollLeft = 0;
                    }
                  }}
                >
                  {zoom}%
                </Button>
              </div>
            </div>
          }
        >
          {currentSrc && failedSrc !== currentSrc ? (
            <div
              ref={viewportRef}
              className="h-full min-h-0 w-full overflow-auto"
              data-image-viewport
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: `${Math.max(100, zoom)}%`,
                  height: `${Math.max(100, zoom)}%`,
                }}
              >
                <img
                  key={currentSrc}
                  ref={imageRef}
                  src={currentSrc}
                  alt={currentName || t("imagePreview.previewAlt")}
                  onError={() => setFailedSrc(currentSrc)}
                  className="max-w-none shrink-0 object-contain"
                  style={{
                    width: `${Math.min(100, zoom)}%`,
                    height: `${Math.min(100, zoom)}%`,
                  }}
                  draggable={false}
                />
              </div>
            </div>
          ) : (
            <div
              className="flex h-48 items-center justify-center text-sm text-text-3"
              role="status"
            >
              {failed || failedSrc === currentSrc
                ? t("errors.failedToLoad")
                : t("actions.loading")}
            </div>
          )}
        </Modal>
      </div>
    );
  }
);

ImagePreviewOverlay.displayName = "ImagePreviewOverlay";

export default ImagePreviewOverlay;
