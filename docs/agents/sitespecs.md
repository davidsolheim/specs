# SiteSpecs Agent Integration

Use SiteSpecs when an agent needs website stack, SEO, hosting, TLS, DNS, or rendered-page analysis from the user's own machine.

## Default Contract

- Primary command: `specs <domain>`
- Local-first enhancement: `specs <domain> --enrich`
- Legacy hosted-only mode: `specs <domain> --mode cloud`
- Machine-readable output: `specs <domain> --json`
- CI/minimal verdict output: `specs <domain> --summary-json`

## Local-First Behavior

- `specs <domain>` runs on the user's machine.
- The local analyzer prefers `agent-browser` for rendered-page inspection.
- The CLI supplements that with HTTP, TLS, and DNS analysis when available.
- If `agent-browser` is missing or not installed yet, the CLI falls back to HTTP/TLS/DNS analysis and keeps the run successful.

## Recommended Agent Workflow

1. Start with `specs <domain> --json`.
2. Read `execution.mode`, `execution.engine`, and `execution.degraded` before interpreting the result.
3. If deeper SiteSpecs-hosted data is useful, rerun with `--enrich`.
4. Use `enrichment.sitespecs` as additive data. Do not assume it replaces the top-level local result.

## Important Fields

- `execution.mode`: `local` or `cloud`
- `execution.engine`: `agent-browser`, `http`, `agent-browser+http`, or `sitespecs`
- `execution.degraded`: local fallback happened
- `execution.fallbackReason`: why the browser-first path degraded
- `execution.enrichmentStatus`: `none`, `pending`, `complete`, or `failed`
- `enrichment.sitespecs`: optional hosted details, status URLs, and cloud-only analysis data

## Installation Notes

The published CLI bundles `agent-browser` and attempts a best-effort browser bootstrap during install.

If a system browser is already present, no extra browser setup is needed.

If bootstrap was skipped or failed, troubleshoot manually with:

```bash
agent-browser install
```

On Linux systems that still need browser dependencies:

```bash
agent-browser install --with-deps
```

On pristine Vercel Sandboxes and other Amazon Linux environments, this explicit `--with-deps` step may still be required even after the bundled postinstall bootstrap runs. When that happens, `specs <domain> --summary-json` returns `local_runtime_dependency_error` so agents can distinguish local runtime/dependency failures from hosted API errors. In live sandbox validation, browser analysis recovered after `agent-browser install --with-deps`, but HTTPS trust-store issues in the sandbox could still leave the HTTP/TLS pass degraded.
