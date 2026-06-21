import { overlay, useOverlayData } from "overlay-kit";
import { GlassButton, GlassCard } from "react-glass-ui";
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

export function closeSidebarOverlay() {
  overlay.close(sidebarOverlayId);
}

export function Header() {
  const overlayData = useOverlayData();
  const isSidebarOpen = overlayData[sidebarOverlayId]?.isOpen === true;

  return (
    <header className={`header ${isSidebarOpen ? "is-sidebar-open" : ""}`}>
      <GlassCard
        className="header-glass"
        contentClassName="header-glass-content"
        blur={3}
        distortion={30}
        chromaticAberration={0}
        backgroundColor="white"
        backgroundOpacity={0.07}
        borderColor="white"
        borderOpacity={0.82}
        borderRadius={20}
        borderSize={1.25}
        brightness={102}
        saturation={115}
        innerLightBlur={10}
        innerLightSpread={1}
        innerLightOpacity={0.1}
        outerLightBlur={16}
        outerLightSpread={1}
        outerLightOpacity={0.04}
        padding="0"
      />
      <button
        className="sidebar-fab"
        type="button"
        aria-label={
          isSidebarOpen ? "Close document list" : "Open document list"
        }
        title={isSidebarOpen ? "Close document list" : "Open document list"}
        onClick={isSidebarOpen ? closeSidebarOverlay : openSidebarOverlay}
      >
        <GlassButton
          className="sidebar-fab-glass"
          contentClassName="sidebar-fab-content"
          blur={16}
          distortion={10}
          chromaticAberration={0}
          backgroundColor="white"
          backgroundOpacity={0.1}
          borderColor="white"
          borderOpacity={0.48}
          borderRadius={9}
          borderSize={1.25}
          brightness={102}
          saturation={115}
          innerLightBlur={8}
          innerLightSpread={1}
          innerLightOpacity={0.12}
          outerLightBlur={12}
          outerLightSpread={1}
          outerLightOpacity={0.04}
          padding="0"
        >
          {isSidebarOpen ? "x" : "Docs"}
        </GlassButton>
      </button>
    </header>
  );
}
