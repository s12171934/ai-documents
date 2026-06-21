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

type PushSubscriptionRecord = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type Env = {
  DOCUMENTS: R2Bucket;
  DOCUMENT_METADATA: KVNamespace;
  DOCUMENT_COORDINATOR: DurableObjectNamespace<DocumentCoordinator>;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

const metadataKey = (id: string) => `documents:${id}:metadata`;
const objectKey = (id: string) => `documents/${id}.html`;
const documentListKey = "documents:index";
const pushSubscriptionsKey = "push:subscriptions";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-max-age": "86400"
};

const withCors = (response: Response) => {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
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

const readDocumentIds = async () =>
  (await bindings.DOCUMENT_METADATA.get<string[]>(documentListKey, "json")) ?? [];

const addDocumentId = async (id: string) => {
  const ids = await readDocumentIds();

  if (ids.includes(id)) return ids;

  const nextIds = [...ids, id].sort((a, b) => a.localeCompare(b));

  await bindings.DOCUMENT_METADATA.put(documentListKey, JSON.stringify(nextIds));

  return nextIds;
};

const base64UrlToBytes = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const bytesToBase64Url = (bytes: ArrayBuffer | Uint8Array) => {
  const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";

  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const concatBytes = (...chunks: Uint8Array[]) => {
  const totalLength = chunks.reduce((length, chunk) => length + chunk.byteLength, 0);
  const bytes = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
};

const toArrayBuffer = (bytes: Uint8Array) => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  return copy.buffer;
};

const readPushSubscriptions = async () =>
  (await bindings.DOCUMENT_METADATA.get<PushSubscriptionRecord[]>(
    pushSubscriptionsKey,
    "json"
  )) ?? [];

const writePushSubscriptions = async (subscriptions: PushSubscriptionRecord[]) => {
  await bindings.DOCUMENT_METADATA.put(pushSubscriptionsKey, JSON.stringify(subscriptions));
};

const savePushSubscription = async (subscription: PushSubscriptionRecord) => {
  const subscriptions = await readPushSubscriptions();
  const nextSubscriptions = [
    ...subscriptions.filter((current) => current.endpoint !== subscription.endpoint),
    subscription
  ];

  await writePushSubscriptions(nextSubscriptions);
};

const deletePushSubscription = async (endpoint: string) => {
  const subscriptions = await readPushSubscriptions();

  await writePushSubscriptions(
    subscriptions.filter((subscription) => subscription.endpoint !== endpoint)
  );
};

const createVapidToken = async (endpoint: string) => {
  if (!bindings.VAPID_PUBLIC_KEY || !bindings.VAPID_PRIVATE_KEY) {
    return null;
  }

  const publicKey = base64UrlToBytes(bindings.VAPID_PUBLIC_KEY);

  if (publicKey.byteLength !== 65) {
    throw new Error("VAPID_PUBLIC_KEY must be an uncompressed P-256 public key.");
  }

  const privateKey = base64UrlToBytes(bindings.VAPID_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToBase64Url(publicKey.slice(1, 33)),
      y: bytesToBase64Url(publicKey.slice(33, 65)),
      d: bytesToBase64Url(privateKey),
      ext: true
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const now = Math.floor(Date.now() / 1000);
  const header = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" }))
  );
  const body = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: now + 12 * 60 * 60,
        sub: bindings.VAPID_SUBJECT ?? "mailto:admin@example.com"
      })
    )
  );
  const unsignedToken = `${header}.${body}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  return `${unsignedToken}.${bytesToBase64Url(signature)}`;
};

const hmac = async (key: ArrayBuffer | Uint8Array, data: Uint8Array) => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key instanceof Uint8Array ? toArrayBuffer(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, toArrayBuffer(data)));
};

const encryptPushPayload = async (subscription: PushSubscriptionRecord, payload: unknown) => {
  const userPublicKey = base64UrlToBytes(subscription.keys.p256dh);
  const authSecret = base64UrlToBytes(subscription.keys.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
  const importedUserPublicKey = await crypto.subtle.importKey(
    "raw",
    userPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: importedUserPublicKey },
    keyPair.privateKey,
    256
  );
  const keyInfo = concatBytes(
    new TextEncoder().encode("WebPush: info"),
    new Uint8Array([0]),
    userPublicKey,
    serverPublicKey
  );
  const inputKeyMaterial = await hmac(
    await hmac(authSecret, new Uint8Array(sharedSecret)),
    concatBytes(keyInfo, new Uint8Array([1]))
  );
  const pseudoRandomKey = await hmac(salt, inputKeyMaterial);
  const contentEncryptionKey = (
    await hmac(
      pseudoRandomKey,
      concatBytes(new TextEncoder().encode("Content-Encoding: aes128gcm"), new Uint8Array([0, 1]))
    )
  ).slice(0, 16);
  const nonce = (
    await hmac(
      pseudoRandomKey,
      concatBytes(new TextEncoder().encode("Content-Encoding: nonce"), new Uint8Array([0, 1]))
    )
  ).slice(0, 12);
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const plaintext = concatBytes(payloadBytes, new Uint8Array([2]));
  const key = await crypto.subtle.importKey("raw", contentEncryptionKey, "AES-GCM", false, [
    "encrypt"
  ]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext)
  );
  const recordSize = new Uint8Array([0, 0, 16, 0]);

  return concatBytes(
    salt,
    recordSize,
    new Uint8Array([serverPublicKey.byteLength]),
    serverPublicKey,
    ciphertext
  );
};

const sendPush = async (subscription: PushSubscriptionRecord, payload: unknown) => {
  const token = await createVapidToken(subscription.endpoint);

  if (!token || !bindings.VAPID_PUBLIC_KEY) {
    return { ok: false, remove: false };
  }

  const body = await encryptPushPayload(subscription, payload);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      authorization: `vapid t=${token}, k=${bindings.VAPID_PUBLIC_KEY}`,
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: "60"
    },
    body
  });

  return {
    ok: response.ok,
    remove: response.status === 404 || response.status === 410
  };
};

const notifyDocumentUpdated = async (metadata: DocumentMetadata) => {
  const subscriptions = await readPushSubscriptions();

  if (subscriptions.length === 0) return;

  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      sendPush(subscription, {
        type: "document.updated",
        document: metadata
      })
    )
  );
  const staleEndpoints = results.flatMap((result, index) =>
    result.status === "fulfilled" && result.value.remove ? [subscriptions[index].endpoint] : []
  );

  if (staleEndpoints.length > 0) {
    await writePushSubscriptions(
      subscriptions.filter((subscription) => !staleEndpoints.includes(subscription.endpoint))
    );
  }
};

const removeDocumentId = async (id: string) => {
  const nextIds = (await readDocumentIds()).filter((documentId) => documentId !== id);

  await bindings.DOCUMENT_METADATA.put(documentListKey, JSON.stringify(nextIds));

  return nextIds;
};

const app = new Elysia({ adapter: CloudflareAdapter })
  .get("/", () => ({
    name: "@ai-documents/server",
    runtime: "cloudflare-worker",
    status: "ok"
  }))
  .get("/health", () => ({
    status: "ok"
  }))
  .get("/documents", async () => {
    const ids = await readDocumentIds();
    const documents = await Promise.all(
      ids.map((id) => bindings.DOCUMENT_METADATA.get<DocumentMetadata>(metadataKey(id), "json"))
    );

    return {
      documents: documents.filter((metadata): metadata is DocumentMetadata => Boolean(metadata))
    };
  })
  .get("/push/vapid-public-key", () => {
    if (!bindings.VAPID_PUBLIC_KEY) {
      return json({ error: "Push is not configured" }, { status: 503 });
    }

    return { publicKey: bindings.VAPID_PUBLIC_KEY };
  })
  .post("/push/subscriptions", async ({ request, status }) => {
    const subscription = (await request.json().catch(() => null)) as PushSubscriptionRecord | null;

    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return json({ error: "Invalid push subscription" }, { status: 400 });
    }

    await savePushSubscription(subscription);

    return status(201, { ok: true });
  })
  .delete("/push/subscriptions", async ({ request }) => {
    const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;

    if (!body?.endpoint) {
      return json({ error: "Missing endpoint" }, { status: 400 });
    }

    await deletePushSubscription(body.endpoint);

    return { ok: true };
  })
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
    await addDocumentId(params.id);
    await getCoordinator(bindings, params.id).fetch("https://internal/documents/touch", {
      method: "POST",
      body: JSON.stringify(metadata)
    });
    await notifyDocumentUpdated(metadata);

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
    await removeDocumentId(params.id);
    await getCoordinator(bindings, params.id).fetch("https://internal/documents/delete", {
      method: "POST"
    });

    return { ok: true };
  })
  .compile();

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    return withCors(await app.fetch(request));
  }
};

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
