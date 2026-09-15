// @vitest-environment jsdom
import { createElement } from "react";
import { expect, it, vi } from "vitest";

import { ACTION_ID } from "@src/ActionSystem";
import { createSmokeRoot, dispatch } from "@src/test/reactSmokeHarness";

import { SpotlightNavigationFooterAction } from "./SpotlightNavigationFooterAction";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  actionDispatch: vi.fn(),
  registered: false,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@src/hooks/navigation/useAppNavigate", () => ({
  useAppNavigate: () => mocks.navigate,
}));
vi.mock("@src/ActionSystem", async (load) => ({
  ...(await load<typeof import("@src/ActionSystem")>()),
  useActionSystemOptional: () => ({
    isValidAction: () => mocks.registered,
    dispatch: mocks.actionDispatch,
  }),
}));

it.each([true, false])(
  "closes once and selects exactly one navigation path (registered=%s)",
  async (registered) => {
    mocks.registered = registered;
    mocks.navigate.mockClear();
    mocks.actionDispatch.mockClear();
    const close = vi.fn();
    const root = createSmokeRoot();
    try {
      await root.render(
        createElement(SpotlightNavigationFooterAction, {
          onClose: close,
          actionId: ACTION_ID.APP_GO_TO_INTEGRATIONS,
          labelKey: "Manage models",
          fallbackPath: "/models",
        })
      );
      await dispatch(() => root.container.querySelector("button")!.click());
      expect(close).toHaveBeenCalledOnce();
      if (registered) {
        expect(mocks.actionDispatch).toHaveBeenCalledExactlyOnceWith(
          ACTION_ID.APP_GO_TO_INTEGRATIONS,
          {},
          "user"
        );
        expect(mocks.navigate).not.toHaveBeenCalled();
        expect(close.mock.invocationCallOrder[0]).toBeLessThan(
          mocks.actionDispatch.mock.invocationCallOrder[0]
        );
      } else {
        expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith("/models");
        expect(mocks.actionDispatch).not.toHaveBeenCalled();
      }
    } finally {
      await root.unmount();
    }
  }
);
