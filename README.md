# specs

The public upstream for the SiteSpecs CLI stack.

This repo is the canonical source of truth for:

- `@sitespecs/specs` - the end-user CLI
- `@sitespecs/analyzer-core` - the reusable local analysis engine
- `@sitespecs/contracts` - the shared response and webhook contracts

## Install

```bash
npm install -g @sitespecs/specs
```

The normal user path is free and local-first:

- `specs <domain>` runs from the user's machine
- `agent-browser` is bundled and bootstrapped best-effort during install
- hosted enrichment remains optional through `--enrich` or `--mode cloud`

## Workspace

- `packages/specs-cli` - published `@sitespecs/specs` package
- `packages/analyzer-core` - published `@sitespecs/analyzer-core` package
- `packages/contracts` - published `@sitespecs/contracts` package
- `skills/sitespecs` - agent-installable skill definition
- `docs/agents/sitespecs.md` - machine-readable usage contract for agents

## Local Development

```bash
npm install
npm run build
npm run typecheck
npm run test
npm run test:webhook-contract
```

Useful package-scoped commands:

```bash
npm run dev --workspace @sitespecs/specs -- example.com
npm run benchmark:tech
npm run release:validate:dry-run
```

## Release Contract

- Stable versions publish under `latest`
- Prerelease versions publish under `next`
- `release:validate:dry-run` packs all publishable packages and runs a clean-room global install smoke test for `@sitespecs/specs`
- the private SiteSpecs platform repo consumes published `@sitespecs/analyzer-core` and `@sitespecs/contracts` versions from npm

## Community

- Public issues and pull requests are welcome
- See [CONTRIBUTING.md](./CONTRIBUTING.md) for the contribution flow
- See [SECURITY.md](./SECURITY.md) for vulnerability reporting

## Related

- [SiteSpecs Platform](https://github.com/teton-web/site-specs-platform) - private web app and worker platform
- [sitespecs.com](https://sitespecs.com) - hosted SiteSpecs product
