import "./styles.css";

const defaultServerUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "http://localhost:8787";

export function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialDocumentId = searchParams.get("document") ?? "demo";
  const initialServerUrl = searchParams.get("server") ?? defaultServerUrl;
  const documentUrl = `${initialServerUrl.replace(/\/+$/, "")}/documents/${encodeURIComponent(
    initialDocumentId
  )}`;

  return (
    <main className="app-shell">
      <section className="workspace">
        <p className="eyebrow">AI Documents</p>
        <div className="toolbar">
          <form className="document-form" method="get">
            <label>
              <span>Document ID</span>
              <input name="document" defaultValue={initialDocumentId} />
            </label>
            <label>
              <span>Server</span>
              <input name="server" defaultValue={initialServerUrl} />
            </label>
            <button type="submit">Open</button>
          </form>
        </div>
        <iframe
          className="document-frame"
          title={`Document ${initialDocumentId}`}
          src={documentUrl}
        />
      </section>
    </main>
  );
}
