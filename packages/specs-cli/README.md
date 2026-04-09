# specs - Website Analysis CLI

A command-line tool for developers to quickly analyze any website's tech stack, hosting, performance, and more.

## Installation

```bash
npm install -g @sitespecs/specs
```

Install the CLI globally from npm, then run the command itself as `specs`.

`specs` now bundles `agent-browser` and performs a best-effort browser runtime bootstrap during install when no local Chrome/Chromium is detected. If browser setup is still unavailable, the CLI falls back to HTTP/TLS/DNS analysis and marks the run as degraded instead of failing outright.

If you want to skip automatic browser bootstrap, set `SPECS_SKIP_AGENT_BROWSER_INSTALL=1` during install. Manual troubleshooting remains available with:

```bash
agent-browser install
# Linux systems that still need browser dependencies:
agent-browser install --with-deps
```

On pristine Vercel Sandboxes and other Amazon Linux environments, the bundled browser bootstrap may still need the explicit Linux dependency step above. In that case `specs <domain> --summary-json` now reports `local_runtime_dependency_error` instead of a generic `api_error`. In live sandbox validation, the browser pass recovered after `agent-browser install --with-deps`, but HTTPS CA trust issues in the sandbox could still keep the HTTP/TLS pass degraded.

## Usage

```bash
# Analyze a website
specs example.com

# Analyze locally, then optionally attach SiteSpecs enrichment
specs example.com --enrich

# Analyze with full details
specs example.com --verbose

# JSON output
specs example.com --json

# Preset profiles
# ci: single-line JSON verdict (and when used with --diff, defaults to failing on drift)
specs example.com --profile ci
specs example.com --profile ci --diff baseline.json
# compare current drift to a prior summary snapshot
specs example.com --summary-json --diff baseline.json --trend previous-summary.json
#
# report: verbose human-readable output
specs example.com --profile report

# Legacy hosted-only mode
specs example.com --mode cloud

# GitHub Actions (copy/paste step snippet)
# 1) capture a baseline once
specs baseline example.com --out baseline.json
# 2) generate a ready-to-paste CI step snippet
specs gha example.com --baseline baseline.json
# output:
# - name: Specs CI
#   run: npx -y @sitespecs/specs@next ci example.com --baseline baseline.json
# the generated default follows the installed CLI release channel:
# prerelease builds emit @next, stable builds emit @latest

# 3) or generate a minimal full GitHub Actions workflow YAML
# (optional) pin trigger branch for --push/--pull-request when generating workflow
specs gha example.com --baseline baseline.json --workflow --branch main
# (optional) pin Node.js version for reproducible CI
specs gha example.com --baseline baseline.json --workflow --node-version 20

# Check specific aspects
specs example.com --tech
specs example.com --seo
specs example.com --performance
```

## Features

- 🔍 **Technology Detection** - Identify frameworks, libraries, CMS, hosting
- 🚀 **Performance Metrics** - Load time, page size, Core Web Vitals
- 📊 **SEO Analysis** - Meta tags, structured data, indexability
- 🌐 **Hosting Info** - Server, CDN, SSL certificate details
- 🧭 **Rendered Page Analysis** - Uses `agent-browser` to inspect JS-rendered pages on the user's machine
- 🔐 **Transport Signals** - TLS, DNS, CNAME, and redirect-aware local checks
- 🤝 **Optional Hosted Enrichment** - Attach SiteSpecs-hosted analysis without replacing the local result

## Output Example

```
$ specs example.com

🌐 example.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Technology Stack
  Framework:    Next.js 16.1.6
  Hosting:      Vercel
  Database:     Neon Postgres
  Analytics:    Google Analytics 4

⚡ Performance
  Load Time:    1.2s
  Page Size:    245 KB
  Requests:     12
  LCP:          1.1s (Good)

🔍 SEO
  Title:        Example Domain
  Description:  ✓ Present
  Open Graph:   ✓ Complete
  SSL:          ✓ Valid (expires in 89 days)

🌍 Hosting
  Server:       Vercel Edge Network
  IP:           76.76.21.21
  Location:     United States
  CDN:          Vercel Edge
  Online Since: 2020-03-15 (4 years)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Modes

- Default local mode: uses `agent-browser` first, then supplements or falls back with local HTTP/TLS/DNS analysis
- `--enrich`: keeps the local result as primary output and attaches SiteSpecs-hosted enrichment under `enrichment.sitespecs`
- `--mode cloud`: legacy hosted-only execution that polls the SiteSpecs API until completion

Use `SPECS_API_KEY` for authenticated hosted access and `SPECS_API_URL` to target non-production API environments.

## API

The CLI only talks to the hosted SiteSpecs API when `--enrich` or `--mode cloud` is enabled.

### Deterministic transport/TLS error contract

- See `docs/cli-transport-tls-error-contract.md` for the canonical mapping table:
  `error code -> deterministic CLI message -> operator remediation`.
- This contract is enforced by `tests/api-fetch-analysis.test.ts` and CI `webhook-contract` checks.

## Agent Setup

Codex skill source: [`../../skills/sitespecs/SKILL.md`](../../skills/sitespecs/SKILL.md)

Generic agent integration guide: [`../../docs/agents/sitespecs.md`](../../docs/agents/sitespecs.md)

Install the Codex skill locally by copying or symlinking the folder into `$CODEX_HOME/skills/sitespecs`:

```bash
mkdir -p "$CODEX_HOME/skills"
ln -s "$(pwd)/skills/sitespecs" "$CODEX_HOME/skills/sitespecs"
```

## Development

```bash
# Clone the repository
git clone https://github.com/davidsolheim/specs.git
cd specs

# Install dependencies
npm install

# Run in development
npm run dev --workspace @sitespecs/specs -- example.com

# Build
npm run build --workspace @sitespecs/specs

# Test
npm run test --workspace @sitespecs/specs
```

## License

MIT © David Solheim

## Related

- [sitespecs.com](https://sitespecs.com) - Full-featured website monitoring and SEO platform
