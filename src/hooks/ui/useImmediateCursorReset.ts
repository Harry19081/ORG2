import { useCallback, useState } from "react";

export function useImmediateCursorReset(isSelected: boolean, clickable = true) {
  const [wasClicked, setWasClicked] = useState(false);
  const cursorReset = wasClicked && clickable && !isSelected;

  const markClicked = useCallback(() => {
    if (clickable && !isSelected) {
      setWasClicked(true);
    }
  }, [clickable, isSelected]);

  const resetCursor = useCallback(() => {
    setWasClicked(false);
  }, []);

  return {
    cursorReset,
    markClicked,
    resetCursor,
  };
}
