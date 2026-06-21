import { Header, openSidebarOverlay } from "./components/header";
import "./styles/global.css";
import "./styles/app.css";
import { useEffect, useState } from "react";
import type { DocumentMetadata } from "./types";
import { setSidebarOverlaySnapshot } from "./components/sidebar";

const defaultServerUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ??
  "http://localhost:8787";

export function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialDocumentId = searchParams.get("document") ?? "demo";
  const [documentId, setDocumentId] = useState(initialDocumentId);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [status, setStatus] = useState("Loading documents");
  const documentUrl = `${defaultServerUrl}/documents/${encodeURIComponent(documentId)}`;

  useEffect(() => {
    setSidebarOverlaySnapshot({
      documents,
      documentId,
      status,
      onSelectDocument: setDocumentId,
    });
  }, [documents, documentId, status]);

  useEffect(() => {
    openSidebarOverlay();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setStatus("Loading documents");

    fetch(`${defaultServerUrl}/documents`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        return response.json() as Promise<{ documents: DocumentMetadata[] }>;
      })
      .then(({ documents }) => {
        setDocuments(documents);

        if (
          documents.length > 0 &&
          !documents.some((document) => document.id === documentId)
        ) {
          setDocumentId(documents[0].id);
        }

        setStatus(
          documents.length > 0
            ? `${documents.length} documents`
            : "No documents",
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;

        setDocuments([]);
        setStatus(
          error instanceof Error ? error.message : "Failed to load documents",
        );
      });

    return () => controller.abort();
  }, [documentId]);

  return (
    <div>
      <Header />
      <main className="app-shell">
        <iframe
          className="document-frame"
          title={`Document ${documentId}`}
          src={documentUrl}
        />
      </main>
    </div>
  );
}
