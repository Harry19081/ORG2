/**
 * Edit-mode image thumbnail with overlay preview and optional remove (X).
 */
import React, { memo, useCallback, useState } from "react";

import Button from "@src/components/Button";
import { Cancel01Icon, HugeiconsIcon } from "@src/icons";
import ImagePreviewOverlay from "@src/scaffold/ImagePreviewOverlay";

const EditModeImageThumbnail: React.FC<{
  dataUrl: string;
  alt: string;
  onRemove?: () => void;
}> = memo(({ dataUrl, alt, onRemove }) => {
  const [showOverlay, setShowOverlay] = useState(false);

  const handleClick = useCallback(() => setShowOverlay(true), []);
  const handleClose = useCallback(() => setShowOverlay(false), []);
  const handleRemove = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onRemove?.();
    },
    [onRemove]
  );

  return (
    <>
      <div
        className="group relative inline-flex h-12 w-12 shrink-0 cursor-pointer rounded-md border border-border-2 bg-fill-1 transition-[border-color] duration-200 ease-in-out hover:border-border-3"
        onClick={handleClick}
        data-testid="edit-mode-image-thumbnail"
      >
        <img
          src={dataUrl}
          alt={alt}
          className="h-full w-full rounded-[inherit] object-cover"
          draggable={false}
          loading="lazy"
          decoding="async"
        />
        {onRemove && (
          <Button
            variant="tertiary"
            appearance="outline"
            hoverIntent="danger"
            size="sidebar"
            shape="circle"
            iconOnly
            htmlType="button"
            onClick={handleRemove}
            className="absolute -top-1 -right-1 z-10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Remove ${alt}`}
            data-testid="edit-mode-image-remove"
            icon={
              <HugeiconsIcon
                icon={Cancel01Icon}
                data-icon="x"
                size={12}
                strokeWidth={2}
              />
            }
          />
        )}
      </div>
      {showOverlay && (
        <ImagePreviewOverlay dataUrl={dataUrl} onClose={handleClose} />
      )}
    </>
  );
});
EditModeImageThumbnail.displayName = "EditModeImageThumbnail";

export default EditModeImageThumbnail;
