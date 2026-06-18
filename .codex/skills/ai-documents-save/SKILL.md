---
name: ai-documents-save
description: Use when the user asks Codex to create, draft, generate, render, upload, publish, or store a document as HTML using this repository's ai-documents CLI. This includes requests to turn content into a standalone HTML document and save it with `ai-documents save`.
---

# AI Documents Save

## Overview

Use this skill to create a standalone HTML document and save it to the AI Documents server through the `ai-documents` CLI.

The expected result is an HTML file on disk plus a successful `ai-documents save ...` command that returns the stored document id and URL.

## Workflow

1. Clarify only when required: ask for missing document content, intended audience, or server URL only if it cannot be inferred from the request or local environment.
2. Create a temporary or repo-local `.html` file containing a complete document:
   - Always use a Korean filename for the HTML file, ending in `.html`.
   - Prefer a concise Korean title-derived filename such as `제품-제안서.html`, `회의록.html`, or `배포-가이드.html`.
   - Include `<!doctype html>`, `<html>`, `<head>`, and `<body>`.
   - Use inline CSS so the saved document is self-contained.
   - Keep JavaScript out unless the user explicitly asks for interactivity.
   - Make the document readable as static HTML without a build step.
3. Choose a document id:
   - Use the user's requested id when provided.
   - Otherwise infer a short kebab-case id from the document title. The id may be ASCII even though the HTML filename must be Korean.
4. Save with the CLI:
   - Prefer the installed command when available:
     ```bash
     ai-documents save path/to/document.html --id document-id
     ```
   - If no global CLI is available, use the workspace CLI:
     ```bash
     bun --filter @s-dante/cli src/index.ts save path/to/document.html --id document-id
     ```
   - Add `--server <url>` when the user supplies a server URL or when the target should differ from `AI_DOCUMENTS_SERVER_URL`.
5. Verify the command output includes a successful `Stored <id> (...)` line and a document URL. Report the saved id and URL to the user.

## Server URL Selection

Use this precedence:

1. Explicit user-provided `--server` or URL.
2. `AI_DOCUMENTS_SERVER_URL` from the shell environment.
3. `apps/cli/.env` when it exists and contains `AI_DOCUMENTS_SERVER_URL=...`.
4. CLI default `http://localhost:8787`.

When using `apps/cli/.env`, pass the value explicitly with `--server` because the published CLI does not automatically load `.env` files.

## HTML Quality Bar

- Match the user's requested document type: report, proposal, memo, guide, invoice, spec, brief, etc.
- Use semantic structure: headings, sections, lists, tables, and figures where appropriate.
- Make print and screen reading pleasant with restrained CSS, a max-width content column, clear typography, and adequate spacing.
- Avoid external assets unless the user asked for them or provided them.
- Do not include placeholder text unless the user asked for a template.

## Verification

Before finishing:

```bash
bun --filter @s-dante/cli build
```

Then run the selected `ai-documents save` command. If the server is unreachable, report the exact command prepared and the connection failure; do not claim the document was saved.
