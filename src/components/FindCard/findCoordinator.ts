import { matchesShortcut } from "@src/config/keyboard/shortcutBindings";

export type FindScope = "session" | "file";
export interface FindTarget {
  scope: FindScope;
  element: () => HTMLElement | null;
  open: () => void;
  close: () => void;
}

const targets = new Set<FindTarget>();
const listeners = new Set<() => void>();
let active: FindTarget | null = null;
let focused: FindTarget | null = null;
const lastFocused: Partial<Record<FindScope, FindTarget>> = {};
let switched = false;
let revision = 0;
let scopes: Record<FindScope, boolean> = { session: false, file: false };
function notify() {
  scopes = {
    session: Boolean(otherTarget("session")),
    file: Boolean(otherTarget("file")),
  };
  revision++;
  listeners.forEach((listener) => listener());
}
export const subscribeFind = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getFindRevision = () => revision;
function available(target: FindTarget) {
  const element = target.element();
  return Boolean(element?.isConnected && element.getClientRects().length);
}
function otherTarget(scope: FindScope) {
  const preferred = lastFocused[scope];
  if (preferred && targets.has(preferred) && available(preferred))
    return preferred;
  return [...targets]
    .reverse()
    .find((target) => target.scope === scope && available(target));
}
export function canSelectFindScope(scope: FindScope) {
  return scopes[scope];
}
export function adoptFindTarget(target: FindTarget) {
  if (active === target) return;
  const previous = active;
  active = target;
  switched = false;
  previous?.close();
  notify();
}
export function closeFindTarget(target: FindTarget) {
  if (active !== target) return;
  active = null;
  switched = false;
  notify();
}
export function selectFindScope(scope: FindScope) {
  const next = otherTarget(scope);
  if (!next || next === active) return;
  const previous = active;
  active = next;
  switched = true;
  previous?.close();
  next.open();
  notify();
}
function onInteraction(event: Event) {
  if (!(event.target instanceof Node)) return;
  if (
    event.target instanceof Element &&
    event.target.closest("[data-find-card]")
  )
    return;
  const containing = [...targets].filter((target) =>
    target.element()?.contains(event.target as Node)
  );
  // An editor can be nested in a session panel. The narrower file owns focus.
  focused =
    containing.find((target) => target.scope === "file") ??
    containing[0] ??
    null;
  if (focused) lastFocused[focused.scope] = focused;
  notify();
}
function onKeyDown(event: KeyboardEvent) {
  if (event.defaultPrevented || !matchesShortcut(event, "find")) return;
  if (event.target instanceof Element && event.target.closest(".xterm")) return;
  const inCard =
    event.target instanceof Element && event.target.closest("[data-find-card]");
  const owner = inCard ? active : focused;
  if (!owner || !available(owner)) return;
  if (
    !inCard &&
    owner.scope === "session" &&
    event.target instanceof Element &&
    event.target.closest(".cm-editor")
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  if (event.repeat) return;
  if (!active) {
    active = owner;
    switched = false;
    owner.open();
  } else {
    const next = otherTarget(active.scope === "session" ? "file" : "session");
    if (!switched && next) {
      selectFindScope(next.scope);
      return;
    }
    const previous = active;
    active = null;
    switched = false;
    previous.close();
  }
  notify();
}
export function registerFindTarget(target: FindTarget) {
  targets.add(target);
  if (targets.size === 1) {
    window.addEventListener("pointerdown", onInteraction, true);
    window.addEventListener("focusin", onInteraction, true);
    window.addEventListener("keydown", onKeyDown, true);
  }
  if (target.element()?.contains(document.activeElement)) focused = target;
  notify();
  return () => {
    targets.delete(target);
    if (focused === target) focused = null;
    if (lastFocused[target.scope] === target) delete lastFocused[target.scope];
    closeFindTarget(target);
    if (!targets.size) {
      window.removeEventListener("pointerdown", onInteraction, true);
      window.removeEventListener("focusin", onInteraction, true);
      window.removeEventListener("keydown", onKeyDown, true);
    }
    notify();
  };
}
