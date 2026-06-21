#!/usr/bin/env node
import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const program = new Command();
const configPath = join(homedir(), ".dante-config");
const defaultServerUrl = "https://worker.s-dante.com";

type SaveOptions = {
  id?: string;
  server?: string;
};

type InitOptions = {
  force?: boolean;
  serverUrl?: string;
};

const normalizeServerUrl = (server: string) => server.replace(/\/+$/, "");

const isNodeError = (error: unknown, code: string) =>
  error instanceof Error && "code" in error && error.code === code;

const parseConfig = (config: string) =>
  config.split(/\r?\n/).reduce<Record<string, string>>((values, line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return values;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      return values;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key) {
      values[key] = value;
    }

    return values;
  }, {});

const readDanteConfig = async () => {
  try {
    return parseConfig(await readFile(configPath, "utf8"));
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return {};
    }

    throw error;
  }
};

const resolveServerUrl = async (server?: string) => {
  if (server) {
    return server;
  }

  const config = await readDanteConfig();

  return config.AI_DOCUMENTS_SERVER_URL ?? defaultServerUrl;
};

const promptServerUrl = async (serverUrl?: string) => {
  if (serverUrl) {
    return serverUrl;
  }

  const readline = createInterface({ input, output });

  try {
    const answer = await readline.question(
      `AI_DOCUMENTS_SERVER_URL (${defaultServerUrl}): `
    );

    return answer.trim() || defaultServerUrl;
  } finally {
    readline.close();
  }
};

const inferDocumentId = (filePath: string) => {
  const fileName = filePath.split(/[\\/]/).at(-1) ?? "document";
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");

  return withoutExtension || "document";
};

const readHtmlFile = async (filePath: string) => {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      throw new Error(`File not found: ${filePath}`);
    }

    throw error;
  }
};

program
  .name("dante")
  .description("CLI entrypoint for AI Documents")
  .version("0.0.0");

program
  .command("hello")
  .description("Check that the CLI is wired correctly")
  .action(() => {
    console.log("AI Documents CLI is ready.");
  });

program
  .command("init")
  .description("Create a Dante config file in your home directory")
  .option(
    "-s, --server-url <url>",
    "Value to save as AI_DOCUMENTS_SERVER_URL in ~/.dante-config."
  )
  .option("-f, --force", "Overwrite an existing config file.")
  .action(async (options: InitOptions) => {
    try {
      const serverUrl = await promptServerUrl(options.serverUrl);
      const config = [
        "# Dante CLI config",
        `AI_DOCUMENTS_SERVER_URL=${normalizeServerUrl(serverUrl)}`,
        ""
      ].join("\n");

      await writeFile(configPath, config, { flag: options.force ? "w" : "wx" });

      console.log(`Created ${configPath}`);
    } catch (error) {
      if (isNodeError(error, "EEXIST")) {
        console.error(`${configPath} already exists. Use --force to overwrite it.`);
        process.exitCode = 1;
        return;
      }

      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

program
  .command("save")
  .argument("<file>", "HTML document file to store")
  .description("Store an HTML document on the AI Documents server")
  .option("-i, --id <id>", "Document id. Defaults to the file name without extension.")
  .option(
    "-s, --server <url>",
    `Server base URL. Defaults to ~/.dante-config or ${defaultServerUrl}.`
  )
  .action(async (file: string, options: SaveOptions) => {
    try {
      const id = options.id ?? inferDocumentId(file);
      const server = normalizeServerUrl(await resolveServerUrl(options.server));
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
