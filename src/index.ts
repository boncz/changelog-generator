import { getCommits } from "./github";
import { generateChangelog } from "./changelog";
import { fetchDocs, retrieveRelevantDocs, findDocsPath } from "./rag";
import { saveChangelog } from "./output";

function parseArgs() {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {
    owner: "supabase",
    repo: "supabase",
    days: "7",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        params[key] = value;
        i++;
      }
    }
  }

  return params;
}

async function main() {
  const { owner, repo, days, docsPath } = parseArgs();
  const daysNum = parseInt(days);

  const until = new Date().toISOString();
  const since = new Date(
    Date.now() - daysNum * 24 * 60 * 60 * 1000
  ).toISOString();

  console.log(`\n🔍 Fetching commits for ${owner}/${repo}...`);
  console.log(`📅 Last ${daysNum} days\n`);

  const commits = await getCommits(owner, repo, since, until);

  if (commits.length === 0) {
    console.log("No commits found in this date range.");
    return;
  }

  console.log(`📚 Looking for docs...`);
  const resolvedDocsPath = await findDocsPath(owner, repo, docsPath);

  let relevantDocs: any[] = [];
  if (resolvedDocsPath) {
    const docs = await fetchDocs(owner, repo, resolvedDocsPath);
    relevantDocs = retrieveRelevantDocs(docs, commits);

    if (relevantDocs.length > 0) {
      console.log(
        `✓ Using ${relevantDocs.length} relevant docs as context:\n` +
        relevantDocs.map((d: any) => `  - ${d.filename}`).join("\n") +
        "\n"
      );
    }
  } else {
    console.log(`⚠ No docs found — generating without context\n`);
  }

  console.log("✨ Generating changelog with Claude...\n");
  const changelog = await generateChangelog(commits, relevantDocs);

  const filepath = saveChangelog(changelog, owner, repo);
  console.log(`\n✓ Changelog saved to: ${filepath}`);
  console.log(`  Open it in your browser to view the formatted output!\n`);
}

main().catch(console.error);