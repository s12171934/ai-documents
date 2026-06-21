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

const withDocumentChrome = (
  html: string,
  documentUrl: string,
) => {
  const baseElement = `<base href="${escapeHtmlAttribute(documentUrl)}">`;

  if (/<head[\s>]/i.test(html)) {
    return html
      .replace(/<head([^>]*)>/i, `<head$1>${baseElement}`)
      .replace(/<\/head>/i, `${documentChromeStyle}</head>`);
  }

  return `${baseElement}${documentChromeStyle}${html}`;
};

const sortDocumentsByUpdatedAt = (documents: DocumentMetadata[]) =>
  [...documents].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );

const getDocumentPageUrl = (documentId: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set("document", documentId);

  return url.toString();
};

export function App() {
  const initialDocumentId =
    new URLSearchParams(window.location.search).get("document") ?? "demo";
  const [documentId, setDocumentId] = useState(initialDocumentId);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [documentHtml, setDocumentHtml] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [status, setStatus] = useState("Loading documents");
  const documentUrl = `${defaultServerUrl}/documents/${encodeURIComponent(documentId)}`;
  const documentPageUrl = getDocumentPageUrl(documentId);
  const currentDocument = documents.find((document) => document.id === documentId);

  useEffect(() => {
    setSidebarOverlaySnapshot({
      documents,
      documentId,
      isDarkMode,
      status,
      onSelectDocument: setDocumentId,
    });
  }, [documents, documentId, isDarkMode, status]);

  useEffect(() => {
    openSidebarOverlay();
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", documentPageUrl);
  }, [documentPageUrl]);

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
        const sortedDocuments = sortDocumentsByUpdatedAt(documents);

        setDocuments(sortedDocuments);

        if (
          sortedDocuments.length > 0 &&
          !sortedDocuments.some((document) => document.id === documentId)
        ) {
          setDocumentId(sortedDocuments[0].id);
        }

        setStatus(
          sortedDocuments.length > 0
            ? `${sortedDocuments.length} documents`
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
    <div className={`app ${isDarkMode ? "is-dark-mode" : ""}`}>
      <Header
        currentDocument={currentDocument}
        documentUrl={documentUrl}
        documentPageUrl={documentPageUrl}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((current) => !current)}
      />
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
