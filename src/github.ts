import { Octokit } from "@octokit/rest";
import * as dotenv from "dotenv";

dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  diff: string;
}

export async function getCommits(
  owner: string,
  repo: string,
  since: string,
  until: string
): Promise<Commit[]> {
  // Fetch the list of commits in the date range
  const { data: commits } = await octokit.repos.listCommits({
    owner,
    repo,
    since,
    until,
    per_page: 20,
  });

  console.log(`Found ${commits.length} commits`);

  // For each commit, fetch the full diff
  const detailed = await Promise.all(
    commits.map(async (commit) => {
      const { data } = await octokit.repos.getCommit({
        owner,
        repo,
        ref: commit.sha,
      });

      // Combine all file patches into one diff string
      const diff = data.files
        ?.map((f) => `File: ${f.filename}\n${f.patch ?? ""}`)
        .join("\n\n") ?? "";

      return {
        sha: commit.sha.slice(0, 7),
        message: commit.commit.message,
        author: commit.commit.author?.name ?? "unknown",
        date: commit.commit.author?.date ?? "",
        diff,
      };
    })
  );

  return detailed;
}