# Contributing

Thanks for helping improve SiteSpecs.

## Development

```bash
npm install
npm run build
npm run typecheck
npm run test
```

For CLI-focused work:

```bash
npm run dev --workspace @sitespecs/specs -- example.com
```

## Pull Requests

- Keep changes scoped and reviewable
- Add or update tests when behavior changes
- Prefer npm-compatible scripts and avoid assuming pnpm-only local behavior
- Preserve the local-first contract for `specs <domain>`

## Release Notes

Use Changesets for normal release work. Stable release workflow details live in [`AGENTS.md`](./AGENTS.md).
