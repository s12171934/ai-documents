import { Header, openSidebarOverlay } from "./components/header";
import "./styles/global.css";
import "./styles/app.css";
import { useEffect, useState } from "react";
import type { DocumentMetadata } from "./types";
import { setSidebarOverlaySnapshot } from "./components/sidebar";

const defaultServerUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ??
  "http://localhost:8787";

const documentChromeStyle = `<style data-ai-documents-client-chrome>
  :root {
    --ai-documents-header-padding-top: calc(4.25rem + 28px);
    --ai-documents-header-padding-bottom: 0px;
  }

  html {
    scroll-padding-top: var(--ai-documents-header-padding-top);
    scroll-padding-bottom: var(--ai-documents-header-padding-bottom);
  }

  body {
    box-sizing: border-box;
    padding-top: var(--ai-documents-header-padding-top) !important;
    padding-bottom: var(--ai-documents-header-padding-bottom) !important;
  }

  @media screen and (max-width: 767px) {
    :root {
      --ai-documents-header-padding-top: 0px;
      --ai-documents-header-padding-bottom: calc(4.25rem + 28px);
    }
  }
</style>`;

const escapeHtmlAttribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

const escapeHtmlText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const withDocumentChrome = (html: string, documentUrl: string) => {
  const baseElement = `<base href="${escapeHtmlAttribute(documentUrl)}">`;

  if (/<head[\s>]/i.test(html)) {
    return html
      .replace(/<head([^>]*)>/i, `<head$1>${baseElement}`)
      .replace(/<\/head>/i, `${documentChromeStyle}</head>`);
  }

  return `${baseElement}${documentChromeStyle}${html}`;
};

export function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialDocumentId = searchParams.get("document") ?? "demo";
  const [documentId, setDocumentId] = useState(initialDocumentId);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [documentHtml, setDocumentHtml] = useState("");
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

    setDocumentHtml("");

    fetch(documentUrl, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        return response.text();
      })
      .then((html) => {
        setDocumentHtml(withDocumentChrome(html, documentUrl));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;

        const message =
          error instanceof Error ? error.message : "Failed to load document";

        setDocumentHtml(
          `<!doctype html><html><body><p>${escapeHtmlText(message)}</p></body></html>`,
        );
      });

    return () => controller.abort();
  }, [documentUrl]);

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
          srcDoc={documentHtml}
        />
      </main>
    </div>
  );
}
