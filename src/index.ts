import { getCommits } from "./github";
import { generateChangelog } from "./changelog";
import { fetchDocs, retrieveRelevantDocs } from "./rag";
import { saveChangelog } from "./output";

async function main() {
  const owner = "supabase";
  const repo = "supabase";

  const until = new Date().toISOString();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  console.log(`Fetching commits for ${owner}/${repo}...`);
  console.log(`From: ${since}`);
  console.log(`To: ${until}\n`);

  const commits = await getCommits(owner, repo, since, until);

  if (commits.length === 0) {
    console.log("No commits found in this date range.");
    return;
  }

  const docs = await fetchDocs(owner, repo, "apps/docs/content/guides");
  const relevantDocs = retrieveRelevantDocs(docs, commits);

  console.log(
    `Using ${relevantDocs.length} relevant docs as context:\n` +
    relevantDocs.map((d) => `  - ${d.filename}`).join("\n") +
    "\n"
  );

  console.log("Generating changelog with Claude...\n");
  const changelog = await generateChangelog(commits, relevantDocs);

  const filepath = saveChangelog(changelog, owner, repo);
  console.log(`\n✓ Changelog saved to: ${filepath}`);
  console.log("Open it in your browser to view the formatted output!");
}

main().catch(console.error);