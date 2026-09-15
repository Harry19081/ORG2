import { type ReactNode, useId } from "react";

import Button from "@src/components/Button";
import Form from "@src/components/Form";
import Input from "@src/components/Input";
import { FolderClosedIcon, FolderOpenIcon, HugeiconsIcon } from "@src/icons";

interface DirectoryPathFieldProps {
  label: string;
  value: string;
  onChange: (path: string) => void;
  onChoosePath: () => Promise<string | null>;
  chooseLabel: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  textAction?: boolean;
  preview?: ReactNode;
}

export function DirectoryPathField({
  label,
  value,
  onChange,
  onChoosePath,
  chooseLabel,
  placeholder,
  disabled,
  readOnly,
  textAction = false,
  preview,
}: DirectoryPathFieldProps) {
  const id = useId();
  const previewId = preview ? `${id}-preview` : undefined;
  return (
    <Form.Item
      presentation="compact"
      htmlFor={id}
      label={label}
      extra={preview}
      extraId={previewId}
      className="mb-3"
    >
      <div className="flex min-w-0 gap-3">
        <Input
          id={id}
          aria-describedby={previewId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          size="default"
          className="min-w-0 flex-1"
          prefix={
            <HugeiconsIcon
              icon={FolderClosedIcon}
              size={16}
              className="text-text-2"
            />
          }
        />
        <Button
          variant="secondary"
          appearance="outline"
          size="default"
          disabled={disabled}
          iconOnly={!textAction}
          icon={
            textAction ? undefined : (
              <HugeiconsIcon icon={FolderOpenIcon} size={16} />
            )
          }
          aria-label={chooseLabel}
          title={chooseLabel}
          className="shrink-0"
          onClick={async () => {
            const path = await onChoosePath();
            if (path) onChange(path);
          }}
        >
          {textAction ? chooseLabel : undefined}
        </Button>
      </div>
    </Form.Item>
  );
}
