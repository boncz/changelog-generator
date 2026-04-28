import * as fs from "fs";
import * as path from "path";
import { Octokit } from "@octokit/rest";
import * as dotenv from "dotenv";

dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export interface DocChunk {
  content: string;
  filename: string;
  score?: number;
}

// Fetch markdown docs from a GitHub repo
export async function fetchDocs(
  owner: string,
  repo: string,
  docsPath: string = "docs"
): Promise<DocChunk[]> {
  console.log(`Fetching docs from ${owner}/${repo}/${docsPath}...`);

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: docsPath,
    });

    if (!Array.isArray(data)) {
      console.log("No docs directory found");
      return [];
    }

    const mdFiles = data.filter(
    (f) => f.type === "file" && (f.name.endsWith(".md") || f.name.endsWith(".mdx"))
    );

    console.log(`Found ${mdFiles.length} markdown files`);

    // Fetch content of each markdown file
    const chunks = await Promise.all(
      mdFiles.slice(0, 10).map(async (file) => {
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo,
          path: file.path,
        });

        if ("content" in fileData) {
          const content = Buffer.from(fileData.content, "base64").toString(
            "utf-8"
          );
          return {
            filename: file.name,
            content: content.slice(0, 1500),
          };
        }
        return null;
      })
    );

    return chunks.filter((c): c is DocChunk => c !== null);
  } catch (err) {
    console.log(`Could not fetch docs: ${err}`);
    return [];
  }
}

// Simple keyword-based retrieval
// We'll use this to find docs most relevant to our commits
export function retrieveRelevantDocs(
  docs: DocChunk[],
  commits: { message: string; diff: string }[],
  topK: number = 3
): DocChunk[] {
  if (docs.length === 0) return [];

  // Extract keywords from commits
  const commitText = commits
    .map((c) => `${c.message} ${c.diff}`)
    .join(" ")
    .toLowerCase();

  const words = commitText
    .split(/\W+/)
    .filter((w) => w.length > 4)
    .reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // Score each doc by keyword overlap with commits
  const scored = docs.map((doc) => {
    const docText = doc.content.toLowerCase();
    let score = 0;
    for (const [word, count] of Object.entries(words)) {
      if (docText.includes(word)) {
        score += count;
      }
    }
    return { ...doc, score };
  });

  // Return top K most relevant docs
  return scored
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, topK);
}