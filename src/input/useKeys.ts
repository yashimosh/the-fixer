// useKeys — keyboard input hook. Returns a ref-like object whose properties
// reflect held-down keys at any moment. Used inside useFrame to drive physics
// without triggering React re-renders for every keystroke.

import { useEffect, useRef } from "react";

export interface DriveKeys {
  fwd: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
}

export function useKeys() {
  const keys = useRef<DriveKeys>({
    fwd: false,
    back: false,
    left: false,
    right: false,
    brake: false,
  });

  useEffect(() => {
    const set = (k: keyof DriveKeys, v: boolean) => { keys.current[k] = v; };

    // Expose keys ref globally — lets JS injection (demo mode, automation,
    // screen recording helpers) drive the truck without event dispatch.
    // Usage: window.__fixerKeys.fwd = true  (held forward)
    //        window.__fixerKeys.fwd = false  (release)
    (window as unknown as Record<string, unknown>).__fixerKeys = keys.current;

    const onDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW": case "ArrowUp":    set("fwd", true);   break;
        case "KeyS": case "ArrowDown":  set("back", true);  break;
        case "KeyA": case "ArrowLeft":  set("left", true);  break;
        case "KeyD": case "ArrowRight": set("right", true); break;
        case "Space":                    set("brake", true); break;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW": case "ArrowUp":    set("fwd", false);   break;
        case "KeyS": case "ArrowDown":  set("back", false);  break;
        case "KeyA": case "ArrowLeft":  set("left", false);  break;
        case "KeyD": case "ArrowRight": set("right", false); break;
        case "Space":                    set("brake", false); break;
      }
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  return keys;
}
