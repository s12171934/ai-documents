self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("ai-documents-app-v1").then((cache) =>
      cache.addAll(["/", "/manifest.webmanifest", "/icon.svg", "/maskable-icon.svg"]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== "ai-documents-app-v1")
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/")),
    );

    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((response) => {
        if (!response.ok) return response;

        const responseCopy = response.clone();

        caches
          .open("ai-documents-app-v1")
          .then((cache) => cache.put(event.request, responseCopy));

        return response;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? { type: "document.updated" };
  const documentId = payload.document?.id ?? "document";

  event.waitUntil(
    Promise.all([
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then((clients) => {
          for (const client of clients) {
            client.postMessage(payload);
          }
        }),
      self.registration.showNotification("Document updated", {
        body: `${documentId} is ready to view.`,
        data: payload,
      }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const documentId = event.notification.data?.document?.id;
  const url = documentId
    ? `/?document=${encodeURIComponent(documentId)}`
    : "/";

  event.waitUntil(self.clients.openWindow(url));
});
