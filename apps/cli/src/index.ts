#!/usr/bin/env node
import { Command } from "commander";
import { readFile } from "node:fs/promises";

const program = new Command();
const defaultServerUrl = process.env.AI_DOCUMENTS_SERVER_URL ?? "http://localhost:8787";

type SaveOptions = {
  id?: string;
  server: string;
};

const normalizeServerUrl = (server: string) => server.replace(/\/+$/, "");

const inferDocumentId = (filePath: string) => {
  const fileName = filePath.split(/[\\/]/).at(-1) ?? "document";
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");

  return withoutExtension || "document";
};

const readHtmlFile = async (filePath: string) => {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }

    throw error;
  }
};

program
  .name("ai-documents")
  .description("CLI entrypoint for AI Documents")
  .version("0.0.0");

program
  .command("hello")
  .description("Check that the CLI is wired correctly")
  .action(() => {
    console.log("AI Documents CLI is ready.");
  });

program
  .command("save")
  .argument("<file>", "HTML document file to store")
  .description("Store an HTML document on the AI Documents server")
  .option("-i, --id <id>", "Document id. Defaults to the file name without extension.")
  .option(
    "-s, --server <url>",
    "Server base URL. Defaults to AI_DOCUMENTS_SERVER_URL or http://localhost:8787.",
    defaultServerUrl
  )
  .action(async (file: string, options: SaveOptions) => {
    try {
      const id = options.id ?? inferDocumentId(file);
      const server = normalizeServerUrl(options.server);
      const html = await readHtmlFile(file);
      const response = await fetch(`${server}/documents/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: {
          "content-type": "text/html; charset=utf-8"
        },
        body: html
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(
          `Upload failed with ${response.status} ${response.statusText}: ${responseText}`
        );
      }

      const metadata = JSON.parse(responseText) as { id: string; byteLength: number };

      console.log(`Stored ${metadata.id} (${metadata.byteLength} bytes)`);
      console.log(`${server}/documents/${encodeURIComponent(metadata.id)}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

program.parse();
