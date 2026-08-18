import { describe, expect, it } from "vitest";

import {
  createChangelogReleases,
  formatGitHubReleaseNotes,
  normalizeReleaseNotes,
} from "../changelog";

describe("normalizeReleaseNotes", () => {
  it("cleans legacy headings and author metadata without losing release content", () => {
    const result = normalizeReleaseNotes(`### &nbsp;&nbsp;🚀 Features

- **paykit**:
  - Add webhook listen workflow &nbsp;-&nbsp; by @maxktz [<samp>(7befd)</samp>](https://github.com/getpaykit/paykit/commit/7befd)
- **web**: Add footer &nbsp;-&nbsp; by @anirudhprmar

### &nbsp;&nbsp;🐞 Bug Fixes

- Fix delivery

##### [View changes on GitHub](https://github.com/getpaykit/paykit/compare/v0.0.4...v0.0.5)`);

    expect(result.content).toContain("### Features");
    expect(result.content).toContain("### Bug Fixes");
    expect(result.content).toContain("Add webhook listen workflow");
    expect(result.content).toContain("[View changes on GitHub]");
    expect(result.content).not.toContain("#####");
    expect(result.content).not.toMatch(/🚀|🐞|by @|<samp>|&nbsp;/);
    expect(result.contributors).toEqual(["maxktz", "anirudhprmar"]);
  });

  it("turns Changesets copy into plain release bullets and keeps PR links", () => {
    const result = normalizeReleaseNotes(`### Patch Changes

- [#42](https://github.com/getpaykit/paykit/pull/42) [\`abc1234\`](https://github.com/getpaykit/paykit/commit/abc1234) Thanks [@maxktz](https://github.com/maxktz)! - Fix billing race.

- [\`def5678\`](https://github.com/getpaykit/paykit/commit/def5678) Thanks [@other-user](https://github.com/other-user)! - Fix retry.

- Support imports from \`@paykitjs/*\`.`);

    expect(result.content).toContain("### Bug Fixes");
    expect(result.content).toContain(
      "- Fix billing race. ([#42](https://github.com/getpaykit/paykit/pull/42))",
    );
    expect(result.content).toContain(
      "- Fix retry. ([`def5678`](https://github.com/getpaykit/paykit/commit/def5678))",
    );
    expect(result.contributors).toEqual(["maxktz", "other-user"]);
  });

  it("extracts a contributor section while preserving the compare link", () => {
    const result = normalizeReleaseNotes(`### Features

- Add reports.

## Contributors

Thanks to everyone who contributed to this release:

@maxktz, @other-user

**Full changelog:** [compare](https://github.com/getpaykit/paykit/compare/v1...v2)`);

    expect(result.content).not.toContain("## Contributors");
    expect(result.content).not.toContain("Thanks to everyone");
    expect(result.content).toContain("**Full changelog:** [compare]");
    expect(result.contributors).toEqual(["maxktz", "other-user"]);
  });
});

describe("createChangelogReleases", () => {
  it("includes stable releases only", () => {
    const release = {
      body: "### Features\n\n- Add reports by @maxktz",
      created_at: "2026-05-08T13:32:21Z",
      draft: false,
      html_url: "https://github.com/getpaykit/paykit/releases/tag/v1.0.0",
      id: 1,
      name: "v1.0.0",
      prerelease: false,
      published_at: "2026-05-08T13:32:55Z",
      tag_name: "v1.0.0",
    };

    const result = createChangelogReleases([
      release,
      { ...release, id: 2, prerelease: true },
      { ...release, id: 3, draft: true },
      { ...release, id: 4, published_at: null },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: "May 8, 2026",
      tag: "v1.0.0",
      contributors: ["maxktz"],
    });
  });
});

describe("formatGitHubReleaseNotes", () => {
  it("publishes clean headings and a contributor section", () => {
    const result = formatGitHubReleaseNotes(`### 🚀 Minor Changes

- [#42](https://github.com/getpaykit/paykit/pull/42) [\`abc1234\`](https://github.com/getpaykit/paykit/commit/abc1234) Thanks [@maxktz](https://github.com/maxktz)! - Add reports.`);

    expect(result).toBe(`### Features

- Add reports. ([#42](https://github.com/getpaykit/paykit/pull/42))

## Contributors

Thanks to everyone who contributed to this release:

@maxktz`);
  });
});
