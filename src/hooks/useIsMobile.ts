import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

const mobileQuery =
  typeof window !== "undefined"
    ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    : null;

function subscribe(cb: () => void) {
  mobileQuery?.addEventListener("change", cb);
  return () => mobileQuery?.removeEventListener("change", cb);
}

function getSnapshot() {
  return mobileQuery?.matches ?? false;
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
