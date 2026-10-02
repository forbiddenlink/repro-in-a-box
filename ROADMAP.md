# Repro-in-a-Box Roadmap

Snapshot as of d98615d (main, 2026-10-02). Current version is in `package.json` and
`CHANGELOG.md`; release-please assigns version numbers, so this file does not.
Reality lives in the code and the issue tracker. Treat this list as a destination, not a status board.

## Shipped

- 12 detectors: JS errors, network, assets, accessibility, web vitals, mixed content, broken links, console warnings, SEO, performance, security, memory leak
- Multi-page crawler with rate limiting, same-domain filtering
- Auto-bundling (ZIP with HAR + screenshots), HAR replay validation, diff comparison
- CLI: `scan`, `validate`, `diff`, `init`; config files (`.reprorc.*`, `package.json`) validated with Zod
- `--fail-on <severity>` exit-code threshold for CI
- HTML and Markdown reports; progress reporting; structured logging
- MCP server (stdio) for Claude Desktop and Claude Code
- Plugin API: `repro-plugin-*` packages, local paths, lifecycle hooks
- Composite GitHub Action: report artifacts, PR comments (`comment-on-pr`), pass/fail threshold (`fail-on`)

## Next

1. Publish to npm from CI (release-please plus npm trusted publishing). npm is behind the repo.
2. CLI and MCP test coverage (`scan`, `validate`, `diff`, MCP tool handlers).
3. Report extras: screenshot gallery, issue timeline.
4. Community plugin template and example plugins.
5. Demo GIF and a launch post for a cheap demand test.

## Later (unscheduled)

Scheduled scanning and scan history, notifications (webhooks, Slack), a REST API, a web dashboard,
a browser extension, AI-assisted bug descriptions, visual regression, mobile testing.

See [CONTRIBUTING.md](CONTRIBUTING.md) to pick something up.
