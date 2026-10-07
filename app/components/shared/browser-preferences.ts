import { useSyncExternalStore } from "react";

const memory = new Map<string, string>();
const changeEvent = "spa-preferences-change";

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(changeEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(changeEvent, listener);
  };
}

function readPreference(key: string, fallback: string) {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function useBrowserPreference(key: string, fallback: string, serverValue: string) {
  return useSyncExternalStore(
    subscribe,
    () => readPreference(key, fallback),
    () => serverValue,
  );
}

export function writeBrowserPreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    memory.delete(key);
  } catch {
    // A escolha continua funcionando nesta aba quando o armazenamento falha.
    memory.set(key, value);
  }
  window.dispatchEvent(new Event(changeEvent));
}
