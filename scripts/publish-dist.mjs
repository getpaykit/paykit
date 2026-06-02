import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Publishes each package's built `dist/` directory (which carries its own
// generated package.json with dist-relative exports and resolved versions).
// We publish from `dist` rather than the package root because the root
// package.json points at `src` for the workspace's source-condition dev setup.
const packageDirs = ["packages/paykit"];

for (const dir of packageDirs) {
  const pkg = JSON.parse(readFileSync(`${dir}/dist/package.json`, "utf8"));
  const spec = `${pkg.name}@${pkg.version}`;

  let alreadyPublished = false;
  try {
    execSync(`npm view ${spec} version`, { stdio: "ignore" });
    alreadyPublished = true;
  } catch {
    // `npm view` exits non-zero when the version does not exist yet.
  }

  if (alreadyPublished) {
    console.log(`✓ ${spec} already on npm, skipping`);
    continue;
  }

  console.log(`→ publishing ${spec}`);
  execSync("npm publish --access public", { cwd: `${dir}/dist`, stdio: "inherit" });
}
