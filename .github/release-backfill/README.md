# GitHub release backfill

PayKit's npm history is ahead of its public GitHub Releases. `v0.0.6` already has a Git
tag but no release. `paykitjs@0.1.6` is published on npm, but `v0.1.6` has neither a tag
nor a release.

Review the prepared notes, then run these commands from a clean checkout of
`getpaykit/paykit`. They create only GitHub releases and the missing `v0.1.6` tag. They do
not publish npm packages.

```sh
gh release create v0.0.6 \
  --repo getpaykit/paykit \
  --verify-tag \
  --title v0.0.6 \
  --notes-file .github/release-backfill/v0.0.6.md

gh release create v0.1.6 \
  --repo getpaykit/paykit \
  --target 0689e655a4ae24947ecb97aceca81e798de5786f \
  --title v0.1.6 \
  --notes-file .github/release-backfill/v0.1.6.md \
  --latest
```

Both commands fail if the corresponding release already exists. Confirm the release
page after each command before continuing.
