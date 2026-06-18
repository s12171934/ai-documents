#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

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

program.parse();
