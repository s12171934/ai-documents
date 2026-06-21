import { overlay, useOverlayData } from "overlay-kit";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { GlassButton, GlassCard } from "react-glass-ui";
import downloadIcon from "../../assets/download.svg";
import infoIcon from "../../assets/info.svg";
import menuBurgerIcon from "../../assets/menu-burger.svg";
import shareIcon from "../../assets/share.svg";
import type { DocumentMetadata } from "../../types";
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

type HeaderProps = {
  currentDocument?: DocumentMetadata;
  documentUrl: string;
  documentPageUrl: string;
};

type HeaderActionButtonProps = {
  children: ReactNode;
  ariaLabel: string;
  title: string;
  onClick: () => void | Promise<void>;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function useCloseOnOutsideClick<T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return ref;
}

function HeaderActionButton({
  children,
  ariaLabel,
  title,
  onClick,
}: HeaderActionButtonProps) {
  return (
    <button
      className="header-action"
      type="button"
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
    >
      <GlassButton
        className="header-action-glass"
        contentClassName="header-action-content"
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
        {children}
      </GlassButton>
    </button>
  );
}

function HeaderIcon({ src }: { src: string }) {
  return <img className="header-icon" src={src} alt="" aria-hidden="true" />;
}

function HeaderPopover({
  children,
  className = "",
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <div
      className={`header-popover ${className}`}
      role="dialog"
      aria-label={ariaLabel}
    >
      <GlassCard
        className="header-popover-glass"
        contentClassName="header-popover-content"
        blur={2}
        distortion={12}
        chromaticAberration={0}
        backgroundColor="white"
        backgroundOpacity={0.16}
        borderColor="white"
        borderOpacity={0.56}
        borderRadius={8}
        borderSize={1}
        brightness={104}
        saturation={125}
        innerLightBlur={10}
        innerLightSpread={1}
        innerLightOpacity={0.12}
        outerLightBlur={18}
        outerLightSpread={1}
        outerLightOpacity={0.08}
        padding="18"
      >
        {children}
      </GlassCard>
    </div>
  );
}

function FileInfoButton({
  currentDocument,
  fileName,
}: {
  currentDocument?: DocumentMetadata;
  fileName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useCloseOnOutsideClick<HTMLDivElement>(isOpen, () =>
    setIsOpen(false),
  );

  return (
    <div className="header-action-group" ref={popoverRef}>
      <HeaderActionButton
        ariaLabel={`Show file information for ${fileName}`}
        title="File information"
        onClick={() => setIsOpen((current) => !current)}
      >
        <HeaderIcon src={infoIcon} />
      </HeaderActionButton>
      {isOpen ? (
        <HeaderPopover ariaLabel="File info">
          <strong>File information</strong>
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{fileName}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>
                {currentDocument
                  ? formatBytes(currentDocument.byteLength)
                  : "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>
                {currentDocument
                  ? new Date(currentDocument.updatedAt).toLocaleString()
                  : "Unknown"}
              </dd>
            </div>
          </dl>
        </HeaderPopover>
      ) : null}
    </div>
  );
}

function DownloadButton({
  documentUrl,
  fileName,
}: {
  documentUrl: string;
  fileName: string;
}) {
  const downloadName = fileName.endsWith(".html")
    ? fileName
    : `${fileName}.html`;

  return (
    <HeaderActionButton
      ariaLabel={`Download ${fileName}`}
      title="Download"
      onClick={async () => {
        const response = await fetch(documentUrl);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = downloadName;
        link.rel = "noopener";
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      }}
    >
      <HeaderIcon src={downloadIcon} />
    </HeaderActionButton>
  );
}

function ShareButton({
  documentPageUrl,
  fileName,
}: {
  documentPageUrl: string;
  fileName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy URL");
  const popoverRef = useCloseOnOutsideClick<HTMLDivElement>(isOpen, () =>
    setIsOpen(false),
  );

  return (
    <div className="header-action-group" ref={popoverRef}>
      <HeaderActionButton
        ariaLabel={`Share ${fileName}`}
        title="Share"
        onClick={() => setIsOpen((current) => !current)}
      >
        <HeaderIcon src={shareIcon} />
      </HeaderActionButton>
      {isOpen ? (
        <HeaderPopover
          className="header-popover-share"
          ariaLabel="Share document"
        >
          <strong>Share document</strong>
          <p>{documentPageUrl}</p>
          <button
            className="header-popover-button"
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(documentPageUrl);
              setCopyLabel("Copied");
              window.setTimeout(() => setCopyLabel("Copy URL"), 1400);
            }}
          >
            <GlassButton
              className="header-popover-button-glass"
              contentClassName="header-popover-button-content"
              blur={14}
              distortion={8}
              chromaticAberration={0}
              backgroundColor="white"
              backgroundOpacity={0.18}
              borderColor="white"
              borderOpacity={0.52}
              borderRadius={8}
              borderSize={1}
              brightness={102}
              saturation={115}
              innerLightBlur={8}
              innerLightSpread={1}
              innerLightOpacity={0.1}
              outerLightBlur={10}
              outerLightSpread={1}
              outerLightOpacity={0.04}
              padding="0"
            >
              {copyLabel}
            </GlassButton>
          </button>
        </HeaderPopover>
      ) : null}
    </div>
  );
}

export function Header({
  currentDocument,
  documentUrl,
  documentPageUrl,
}: HeaderProps) {
  const overlayData = useOverlayData();
  const isSidebarOpen = overlayData[sidebarOverlayId]?.isOpen === true;
  const fileName = currentDocument?.id ?? "document";

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
          <HeaderIcon src={menuBurgerIcon} />
        </GlassButton>
      </button>
      <div className="header-actions" aria-label="Document actions">
        <FileInfoButton currentDocument={currentDocument} fileName={fileName} />
        <DownloadButton documentUrl={documentUrl} fileName={fileName} />
        <ShareButton documentPageUrl={documentPageUrl} fileName={fileName} />
      </div>
    </header>
  );
}
