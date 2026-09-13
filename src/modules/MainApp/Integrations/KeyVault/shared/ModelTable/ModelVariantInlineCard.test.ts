import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { resolveModelVariantFields } from "@src/util/modelVariants";

import ModelVariantInlineCard from "./ModelVariantInlineCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const dropdown = vi.hoisted(() => ({
  value: "",
  onChange: vi.fn<(modelId: string) => void>(),
}));
vi.mock("@src/components/ModelPropertiesDropdown", () => ({
  default: (props: typeof dropdown) => {
    Object.assign(dropdown, props);
    return null;
  },
}));

describe("ModelVariantInlineCard default persistence", () => {
  it.each([
    ["o4-mini", "o4"],
    ["claude-opus-4-7", "claude-opus-4-7"],
  ])(
    "preserves the %s family key after filtering bare choices",
    (base, key) => {
      const onChange = vi.fn();
      renderToStaticMarkup(
        React.createElement(ModelVariantInlineCard, {
          variants: [base, `${base}-low`, `${base}-medium`, `${base}-high`].map(
            (model) => resolveModelVariantFields(model)
          ),
          embedded: true,
          defaultVariantByBaseModel: new Map([[key, `${base}-high`]]),
          onChangeDefaultVariant: onChange,
        })
      );

      expect(dropdown.value).toBe(`${base}-high`);
      dropdown.onChange(`${base}-low`);
      expect(onChange).toHaveBeenCalledWith(key, `${base}-low`);
    }
  );
});
