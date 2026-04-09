# specs Agent Notes

This repo is the canonical public upstream for the SiteSpecs CLI stack.

- `@sitespecs/specs`
- `@sitespecs/analyzer-core`
- `@sitespecs/contracts`

The private platform repo should consume released versions from npm. Do not treat the private monorepo as the source of truth for CLI releases anymore.

## Stable Release Playbook

### 1. Update versions intentionally

- Use Changesets for normal follow-up releases
- For bootstrap or migration releases, ensure the package versions in:
  - `packages/contracts/package.json`
  - `packages/analyzer-core/package.json`
  - `packages/specs-cli/package.json`
  match the intended publish state before the release workflow runs

### 2. Run the full verification contract

From the repo root:

```bash
pnpm install --frozen-lockfile
npm run build
npm run typecheck
npm run test
npm run test:webhook-contract
npm run release:validate:dry-run
```

### 3. Publish from this repo only

The release workflow on `main` is the source of truth. It validates, then publishes any unpublished package versions in this order:

1. `@sitespecs/contracts`
2. `@sitespecs/analyzer-core`
3. `@sitespecs/specs`

Stable semvers publish to `latest`. Prereleases publish to the prerelease tag, such as `next`.

### 4. Verify registry state

```bash
npm dist-tag ls @sitespecs/specs
npm view @sitespecs/specs@latest version --json
npm view @sitespecs/analyzer-core version --json
npm view @sitespecs/contracts version --json
```

### 5. Verify the end-user install path

The dry-run release validator already performs the clean-room smoke test, but after a real release you should still verify:

```bash
tmpdir=$(mktemp -d)
npm install -g --prefix "$tmpdir" @sitespecs/specs@latest
"$tmpdir/bin/specs" --version
rm -rf "$tmpdir"
```

### 6. Keep public docs aligned

If the install flow, release flow, or hosted-enrichment contract changes:

- update `README.md`
- update `packages/specs-cli/README.md`
- update `docs/agents/sitespecs.md`
- update `skills/sitespecs/SKILL.md`
