import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { env } from "cloudflare:workers";

type DocumentMetadata = {
  id: string;
  key: string;
  contentType: "text/html";
  byteLength: number;
  createdAt: string;
  updatedAt: string;
};

type Env = {
  DOCUMENTS: R2Bucket;
  DOCUMENT_METADATA: KVNamespace;
  DOCUMENT_COORDINATOR: DurableObjectNamespace<DocumentCoordinator>;
};

const metadataKey = (id: string) => `documents:${id}:metadata`;
const objectKey = (id: string) => `documents/${id}.html`;

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers
    }
  });

const requireHtml = (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("text/html")) {
    return json(
      {
        error: "Expected text/html",
        detail: "Send the document body as HTML with content-type: text/html."
      },
      { status: 415 }
    );
  }

  return null;
};

const getCoordinator = (env: Env, id: string) => {
  const durableObjectId = env.DOCUMENT_COORDINATOR.idFromName(id);

  return env.DOCUMENT_COORDINATOR.get(durableObjectId);
};

const bindings = env as Env;

export default new Elysia({ adapter: CloudflareAdapter })
  .get("/", () => ({
    name: "@ai-documents/server",
    runtime: "cloudflare-worker",
    status: "ok"
  }))
  .get("/health", () => ({
    status: "ok"
  }))
  .post("/documents/:id", async ({ params, request, status }) => {
    const htmlError = requireHtml(request);
    if (htmlError) return htmlError;

    const html = await request.text();
    const now = new Date().toISOString();
    const key = objectKey(params.id);
    const existing = await bindings.DOCUMENT_METADATA.get<DocumentMetadata>(
      metadataKey(params.id),
      "json"
    );
    const metadata: DocumentMetadata = {
      id: params.id,
      key,
      contentType: "text/html",
      byteLength: new TextEncoder().encode(html).byteLength,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    await bindings.DOCUMENTS.put(key, html, {
      httpMetadata: {
        contentType: "text/html; charset=utf-8"
      },
      customMetadata: {
        documentId: params.id,
        updatedAt: now
      }
    });

    await bindings.DOCUMENT_METADATA.put(metadataKey(params.id), JSON.stringify(metadata));
    await getCoordinator(bindings, params.id).fetch("https://internal/documents/touch", {
      method: "POST",
      body: JSON.stringify(metadata)
    });

    return status(existing ? 200 : 201, metadata);
  })
  .get("/documents/:id", async ({ params }) => {
    const metadata = await bindings.DOCUMENT_METADATA.get<DocumentMetadata>(
      metadataKey(params.id),
      "json"
    );

    if (!metadata) {
      return json({ error: "Document not found" }, { status: 404 });
    }

    const object = await bindings.DOCUMENTS.get(metadata.key);

    if (!object) {
      return json({ error: "Document object missing" }, { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType ?? "text/html; charset=utf-8",
        "cache-control": "private, no-store",
        "x-document-id": params.id,
        "x-document-updated-at": metadata.updatedAt
      }
    });
  })
  .get("/documents/:id/meta", async ({ params }) => {
    const metadata = await bindings.DOCUMENT_METADATA.get<DocumentMetadata>(
      metadataKey(params.id),
      "json"
    );

    if (!metadata) {
      return json({ error: "Document not found" }, { status: 404 });
    }

    const state = await getCoordinator(bindings, params.id).fetch(
      "https://internal/documents/state"
    );

    return {
      ...metadata,
      coordinator: await state.json()
    };
  })
  .post("/documents/:id/events", async ({ params, request }) => {
    const event = await request.json().catch(() => ({}));
    const response = await getCoordinator(bindings, params.id).fetch(
      "https://internal/documents/events",
      {
        method: "POST",
        body: JSON.stringify(event)
      }
    );

    return response;
  })
  .delete("/documents/:id", async ({ params }) => {
    const metadata = await bindings.DOCUMENT_METADATA.get<DocumentMetadata>(
      metadataKey(params.id),
      "json"
    );

    if (!metadata) {
      return json({ error: "Document not found" }, { status: 404 });
    }

    await bindings.DOCUMENTS.delete(metadata.key);
    await bindings.DOCUMENT_METADATA.delete(metadataKey(params.id));
    await getCoordinator(bindings, params.id).fetch("https://internal/documents/delete", {
      method: "POST"
    });

    return { ok: true };
  })
  .compile();

export class DocumentCoordinator {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/documents/touch") {
      const metadata = (await request.json()) as DocumentMetadata;

      await this.state.storage.put("metadata", metadata);
      await this.state.storage.put("updatedAt", metadata.updatedAt);

      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/documents/events") {
      const event = await request.json().catch(() => ({}));
      const events = ((await this.state.storage.get("events")) ?? []) as unknown[];
      const nextEvents = [
        ...events.slice(-49),
        {
          ...event,
          receivedAt: new Date().toISOString()
        }
      ];

      await this.state.storage.put("events", nextEvents);

      return json({ ok: true, eventCount: nextEvents.length });
    }

    if (request.method === "POST" && url.pathname === "/documents/delete") {
      await this.state.storage.deleteAll();

      return json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/documents/state") {
      const metadata = await this.state.storage.get<DocumentMetadata>("metadata");
      const events = ((await this.state.storage.get("events")) ?? []) as unknown[];

      return json({
        metadata,
        eventCount: events.length,
        lastEvent: events.at(-1) ?? null
      });
    }

    return json({ error: "Not found" }, { status: 404 });
  }
}
