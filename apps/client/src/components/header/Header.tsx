import { overlay, useOverlayData } from "overlay-kit";
import { Sidebar, useSidebarOverlaySnapshot } from "../sidebar";
import "./Header.css";

export const sidebarOverlayId = "document-sidebar";

function DocumentSidebarOverlay({
  isOpen,
  close,
}: {
  isOpen: boolean;
  close: () => void;
}) {
  const { documents, documentId, status, onSelectDocument } =
    useSidebarOverlaySnapshot();

  return (
    <Sidebar
      documents={documents}
      documentId={documentId}
      status={status}
      isOpen={isOpen}
      onClose={close}
      onSelectDocument={onSelectDocument}
    />
  );
}

export function openSidebarOverlay() {
  overlay.open(
    ({ isOpen, close }) => (
      <DocumentSidebarOverlay isOpen={isOpen} close={close} />
    ),
    { overlayId: sidebarOverlayId },
  );
}

export function Header() {
  const overlayData = useOverlayData();
  const isSidebarOpen = overlayData[sidebarOverlayId]?.isOpen === true;

  return (
    <div className="header">
      {!isSidebarOpen ? (
        <button
          className="sidebar-fab"
          type="button"
          aria-label="Open document list"
          title="Open document list"
          onClick={openSidebarOverlay}
        >
          Docs
        </button>
      ) : null}
    </div>
  );
}
