self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? { type: "document.updated" };

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clients) => {
        for (const client of clients) {
          client.postMessage(payload);
        }

        if (clients.length > 0) {
          return undefined;
        }

        const documentId = payload.document?.id ?? "document";

        return self.registration.showNotification("Document updated", {
          body: `${documentId} is ready to view.`,
          data: payload,
        });
      }),
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
