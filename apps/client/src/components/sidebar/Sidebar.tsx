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
      <div className="sidebar-header">
        <div>
          <p className="eyebrow">AI Documents</p>
          <strong>Documents</strong>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          onClick={onClose}
        >
          x
        </button>
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
    </aside>
  );
}
