import "./styles.css";
import { useEffect, useMemo, useState } from "react";

const defaultServerUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "http://localhost:8787";

type DocumentMetadata = {
  id: string;
  byteLength: number;
  updatedAt: string;
};

export function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialDocumentId = searchParams.get("document") ?? "demo";
  const initialServerUrl = searchParams.get("server") ?? defaultServerUrl;
  const [serverUrl, setServerUrl] = useState(initialServerUrl);
  const [documentId, setDocumentId] = useState(initialDocumentId);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [status, setStatus] = useState("Loading documents");
  const normalizedServerUrl = useMemo(() => serverUrl.replace(/\/+$/, ""), [serverUrl]);
  const documentUrl = `${normalizedServerUrl}/documents/${encodeURIComponent(documentId)}`;

  useEffect(() => {
    const controller = new AbortController();

    setStatus("Loading documents");

    fetch(`${normalizedServerUrl}/documents`, {
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        return response.json() as Promise<{ documents: DocumentMetadata[] }>;
      })
      .then(({ documents }) => {
        setDocuments(documents);

        if (documents.length > 0 && !documents.some((document) => document.id === documentId)) {
          setDocumentId(documents[0].id);
        }

        setStatus(documents.length > 0 ? `${documents.length} documents` : "No documents");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;

        setDocuments([]);
        setStatus(error instanceof Error ? error.message : "Failed to load documents");
      });

    return () => controller.abort();
  }, [documentId, normalizedServerUrl]);

  return (
    <main className={`app-shell ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      {isSidebarCollapsed ? (
        <button
          className="sidebar-fab"
          type="button"
          aria-label="Open document list"
          title="Open document list"
          onClick={() => setSidebarCollapsed(false)}
        >
          Docs
        </button>
      ) : null}

      <aside className="sidebar" aria-label="Documents">
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
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            x
          </button>
        </div>

        <div className="server-control">
          <label>
            <span>Server</span>
            <input
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              aria-label="Server URL"
            />
          </label>
        </div>

        <div className="document-count">{status}</div>

        <nav className="document-list">
          {documents.map((document) => (
            <button
              className={document.id === documentId ? "document-item is-active" : "document-item"}
              key={document.id}
              type="button"
              onClick={() => setDocumentId(document.id)}
            >
              <strong>{document.id}</strong>
              <span>{new Date(document.updatedAt).toLocaleString()}</span>
            </button>
          ))}
        </nav>
      </aside>

      <iframe className="document-frame" title={`Document ${documentId}`} src={documentUrl} />
    </main>
  );
}
