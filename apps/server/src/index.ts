import { Elysia } from "elysia";

const port = Number(process.env.PORT ?? 3000);

const app = new Elysia()
  .get("/", () => ({
    name: "@ai-documents/server",
    status: "ok"
  }))
  .get("/health", () => ({
    status: "ok"
  }))
  .listen(port);

console.log(`Elysia server is running at ${app.server?.hostname}:${app.server?.port}`);
