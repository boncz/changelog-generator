import Anthropic from "@anthropic-ai/sdk";
import { Commit } from "./github";
import { DocChunk } from "./rag";
import * as dotenv from "dotenv";

dotenv.config();

const client = new Anthropic();

export async function generateChangelog(
  commits: Commit[],
  relevantDocs: DocChunk[] = []
): Promise<string> {
  const commitSummary = commits
    .map(
      (c) => `
COMMIT: ${c.sha}
Author: ${c.author}
Date: ${c.date}
Message: ${c.message}
Changes:
${c.diff.slice(0, 2000)}${c.diff.length > 2000 ? "... (truncated)" : ""}
`
    )
    .join("\n---\n");

  // Build doc context string if we have relevant docs
  const docContext =
    relevantDocs.length > 0
      ? `
EXISTING DOCUMENTATION CONTEXT:
The following existing docs are relevant to these changes. Use them to understand
what was previously documented and reference them where appropriate.

${relevantDocs.map((d) => `[${d.filename}]:\n${d.content}`).join("\n\n---\n\n")}
`
      : "";

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a technical writer generating a professional changelog for software developers.

Based on the following git commits and diffs, write a clear, well-structured changelog entry.
${docContext}
Guidelines:
- Group changes into categories: Features, Bug Fixes, Improvements, Breaking Changes
- Only include categories that have actual changes
- Write in plain English, not git commit messages
- Be specific about what changed and why it matters to users
- If existing docs are provided, reference them where relevant
- Skip merge commits and trivial changes

COMMITS:
${commitSummary}

Write the changelog now:`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return content.text;
}