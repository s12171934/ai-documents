import { useSyncExternalStore } from "react";
import type { DocumentMetadata } from "../../types";

export type SidebarOverlaySnapshot = {
  documents: DocumentMetadata[];
  documentId: string;
  isDarkMode: boolean;
  status: string;
  onSelectDocument: (documentId: string) => void;
};

let snapshot: SidebarOverlaySnapshot = {
  documents: [],
  documentId: "",
  isDarkMode: false,
  status: "Loading documents",
  onSelectDocument: () => {},
};

const listeners = new Set<() => void>();

export function setSidebarOverlaySnapshot(nextSnapshot: SidebarOverlaySnapshot) {
  snapshot = nextSnapshot;
  listeners.forEach((listener) => listener());
}

export function useSidebarOverlaySnapshot() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
}
