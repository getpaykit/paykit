import { readFile, writeFile } from "node:fs/promises";

import { formatGitHubReleaseNotes } from "../apps/web/src/lib/changelog.ts";

const notesPath = process.argv[2];

if (!notesPath) {
  console.error("Usage: node scripts/format-github-release-notes.mjs <notes-file>");
  process.exit(1);
}

const source = await readFile(notesPath, "utf8");
await writeFile(notesPath, `${formatGitHubReleaseNotes(source)}\n`);
