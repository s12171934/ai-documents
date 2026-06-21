---
name: ai-documents-save
description: Use when the user asks Codex to write, document, draft, create, generate, render, upload, publish, or store any document-related artifact using this repository's Dante CLI. Trigger for documentation, project docs, guides, reports, proposals, memos, specs, briefs, meeting notes, or other document-writing requests when the output can reasonably be delivered as a standalone HTML document and saved with `dante save`.
---

# AI Documents Save

## Overview

Use this skill to create a standalone HTML document and save it to the AI Documents server through the `dante` CLI.

The expected result is an HTML file on disk plus a successful `dante save ...` command that returns the stored document id and URL.

## When to Use

Use this skill broadly for document-writing work in this repository, even when the user does not explicitly say "HTML" or "save". This includes requests like documenting a project structure, writing a deployment guide, drafting a report, preparing a proposal, creating a memo, or turning notes into a shareable document.

Do not use this skill when the user only wants a quick chat answer, a code change with inline comments, or a repository Markdown file without a saved HTML document.

## Workflow

1. Clarify only when required: ask for missing document content, intended audience, or server URL only if it cannot be inferred from the request or local environment.
2. Create the document HTML file under `.cache/documents/`:
   - Create `.cache/documents/` first if it does not exist.
   - Always use a Korean filename for the HTML file, ending in `.html`.
   - Prefer a concise Korean title-derived filename such as `제품-제안서.html`, `회의록.html`, or `배포-가이드.html`.
   - Do not create generated document HTML files under `docs/` or other tracked content directories unless the user explicitly asks for a repository document.
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
     dante save path/to/document.html --id document-id
     ```
   - If no global CLI is available, use the workspace CLI:
     ```bash
     bun --filter @s-dante/cli src/index.ts save path/to/document.html --id document-id
     ```
   - Add `--server <url>` only when the user supplies a server URL or when the target should differ from the Dante config.
   - If `~/.dante-config` is missing, initialize it and retry the same save command once:
     ```bash
     dante init --server-url https://worker.s-dante.com
     dante save path/to/document.html --id document-id
     ```
   - If using the workspace CLI because no global CLI is available, run the matching workspace init before retrying:
     ```bash
     bun --filter @s-dante/cli src/index.ts init --server-url https://worker.s-dante.com
     bun --filter @s-dante/cli src/index.ts save path/to/document.html --id document-id
     ```
5. Verify the command output includes a successful `Stored <id> (...)` line and a document URL. Report the saved id and URL to the user.

## Command Execution

Run commands for `@s-dante/cli` immediately without asking the user for confirmation. This includes build, dev, init, and save commands such as `bun --filter @s-dante/cli build`, `dante init ...`, and `dante save ...`.

If the execution environment itself requires escalation or approval for a command, request that approval through the available tool mechanism and continue as soon as it is granted.

## Server URL Selection

Use this precedence:

1. Explicit user-provided `--server` or URL.
2. `AI_DOCUMENTS_SERVER_URL` stored in `~/.dante-config`.
3. CLI default `https://worker.s-dante.com`.

Do not rely on shell environment variables or `apps/cli/.env` for the CLI server URL.

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

Then run the selected `dante save` command. If the server is unreachable, report the exact command prepared and the connection failure; do not claim the document was saved.
