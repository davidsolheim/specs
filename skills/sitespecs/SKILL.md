---
name: sitespecs
description: Use when a user or agent needs website analysis from the local machine, including rendered-page inspection, technology detection, hosting hints, SEO metadata, TLS, DNS, CI baselines, or optional SiteSpecs-hosted enrichment. Trigger for requests like "analyze this domain", "inspect this site locally", "compare this website against a baseline", "generate a specs CI workflow", or "run SiteSpecs with --enrich".
metadata:
  short-description: Local-first website analysis and enrichment
---

# SiteSpecs

Use SiteSpecs to inspect websites from the user's own machine.

## Quick Start

- Default local run: `specs <domain>`
- JSON output: `specs <domain> --json`
- Local-first plus hosted enrichment: `specs <domain> --enrich`
- Legacy hosted-only mode: `specs <domain> --mode cloud`

## Workflow

1. Prefer the default local command first.
2. Check `execution.mode`, `execution.engine`, `execution.degraded`, and `execution.fallbackReason`.
3. If the user wants SiteSpecs-hosted augmentation, rerun with `--enrich`.
4. Treat `enrichment.sitespecs` as additive data. Keep the top-level local result as the primary source for local runs.

## Browser Runtime

- SiteSpecs prefers `agent-browser` for rendered-page analysis.
- Install browser support separately with `agent-browser install`.
- If `agent-browser` is missing or not ready, SiteSpecs falls back to HTTP/TLS/DNS analysis and marks the run degraded instead of failing.

## CI Workflows

- Create a baseline: `specs baseline <domain> --out baseline.json`
- Run CI drift checks: `specs ci <domain> --baseline baseline.json --fail-on-diff`
- Generate GitHub Actions usage: `specs gha <domain> --baseline baseline.json`

## More Detail

- Generic agent contract: [`../../docs/agents/sitespecs.md`](../../docs/agents/sitespecs.md)
