import {
  cleanupDir,
  createStandaloneDemoCopy,
  parseVersionFlag,
  runCommand,
  sandboxConfig,
} from "./sandbox";

function printHelp() {
  console.log("Deploy standalone demo app copy to Vercel sandbox production");
  console.log("Usage: pnpm deploy:sandbox --version <npm-spec>");
}

async function main() {
  const { helpRequested, version } = parseVersionFlag(process.argv.slice(2));

  if (helpRequested) {
    printHelp();
    return;
  }

  const tempDir = await createStandaloneDemoCopy(version);

  try {
    console.log(`Deploy sandbox with PayKit version ${version}`);
    console.log(`Project ${sandboxConfig.projectName} -> ${sandboxConfig.appUrl}`);

    await runCommand(
      "vercel",
      [
        "deploy",
        "--prod",
        "--yes",
        "--scope",
        sandboxConfig.orgId,
        "--meta",
        `paykitVersion=${version}`,
        "--meta",
        "app=demo",
        "--meta",
        "target=sandbox",
      ],
      tempDir,
    );
  } finally {
    await cleanupDir(tempDir);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
