# Using the Repro-in-a-Box GitHub Action

Scan a URL in CI and upload HTML/Markdown reports as artifacts.

```yaml
name: Repro Scan

on:
  pull_request:
  workflow_dispatch:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - name: Scan staging
        id: repro
        uses: ./
        # Or: uses: forbiddenlink/repro-in-a-box@main
        with:
          url: https://example.com
          max-pages: '5'
          max-depth: '2'
          format: html
          fail-on: none

      - name: Summary
        run: |
          echo "Issues: ${{ steps.repro.outputs.issue-count }}"
          echo "Report: ${{ steps.repro.outputs.report-path }}"
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `url` | required | Target URL |
| `max-pages` | `10` | Crawl page cap |
| `max-depth` | `2` | Crawl depth |
| `format` | `html` | `html` or `markdown` |
| `fail-on` | `none` | Fail the job when an issue at or above this severity is found: `none`, `info`, `warning`, `error`, `critical`. The report and artifacts are still produced before the job fails. |
| `fail-on-issues` | `false` | Deprecated. `true` behaves like `fail-on: info`. |
| `comment-on-pr` | `false` | Post the markdown report as a PR comment (`format` must be `markdown`) |
| `output-dir` | `repro-results` | Artifact directory |

## Outputs

| Output | Description |
|--------|-------------|
| `report-path` | HTML or Markdown report path |
| `json-path` | Machine-readable JSON results |
| `issue-count` | Total issues found |

JSON is always written alongside the human report so PR bots and later steps can parse results.

PR comments need `pull-requests: write` on the caller workflow:

```yaml
permissions:
  contents: read
  pull-requests: write
```

