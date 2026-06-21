import { GlassButton, GlassCard } from "react-glass-ui";
import closeIcon from "../../assets/close.svg";
import type { DocumentMetadata } from "../../types";
import "./Sidebar.css";

type SidebarProps = {
  documents: DocumentMetadata[];
  documentId: string;
  status: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectDocument: (documentId: string) => void;
};

export function Sidebar({
  documents,
  documentId,
  status,
  isOpen,
  onClose,
  onSelectDocument,
}: SidebarProps) {
  return (
    <aside
      className={`sidebar ${isOpen ? "is-open" : ""}`}
      aria-label="Documents"
    >
      <GlassCard
        className="sidebar-glass"
        contentClassName="sidebar-content"
        blur={22}
        distortion={14}
        chromaticAberration={0}
        backgroundColor="white"
        backgroundOpacity={0.07}
        borderColor="white"
        borderOpacity={0.46}
        borderRadius={10}
        borderSize={1.25}
        brightness={102}
        saturation={120}
        innerLightBlur={12}
        innerLightSpread={1}
        innerLightOpacity={0.12}
        outerLightBlur={18}
        outerLightSpread={1}
        outerLightOpacity={0.05}
        padding="0"
      >
        <div className="sidebar-header">
          <button
            className="sidebar-close"
            type="button"
            aria-label="Close document list"
            title="Close document list"
            onClick={onClose}
          >
            <GlassButton
              className="sidebar-close-glass"
              contentClassName="sidebar-close-content"
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
              <img
                className="sidebar-icon"
                src={closeIcon}
                alt=""
                aria-hidden="true"
              />
            </GlassButton>
          </button>
          <div>
            <p className="eyebrow">AI Documents</p>
            <strong>Documents</strong>
          </div>
        </div>

        <div className="document-count">{status}</div>

        <nav className="document-list">
          {documents.map((document) => (
            <button
              className={
                document.id === documentId
                  ? "document-item is-active"
                  : "document-item"
              }
              key={document.id}
              type="button"
              onClick={() => onSelectDocument(document.id)}
            >
              <strong>{document.id}</strong>
              <span>{new Date(document.updatedAt).toLocaleString()}</span>
            </button>
          ))}
        </nav>
      </GlassCard>
    </aside>
  );
}
