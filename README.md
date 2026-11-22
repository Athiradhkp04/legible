# legible

Spell-check for APIs: scores an OpenAPI spec on how well AI agents can use it, and says exactly what to fix.

## Features

- **Zero dependencies** in the core scorer (works in browser and Node)
- **$ref resolution** with cycle detection for real-world specs
- **OpenAPI 3.0 and Swagger 2.0** support
- **Multiple output formats**: text, JSON, Markdown
- **CI/CD integration** via GitHub Action
- **MCP server** for Claude Desktop and Cursor
- **Web interface** with dark mode support

## Installation

```bash
npm install -g legible-api
# For YAML support: npm install js-yaml
```

## Usage

### Web

Open `index.html` in your browser or deploy to GitHub Pages. Paste a spec and get instant feedback.

Demo link: `https://athiradhkp04.github.io/legible/?spec=https://example.com/openapi.json`

### CLI

```bash
# Basic scoring
legible openapi.json

# With minimum score threshold (exit code 1 if below)
legible openapi.json --min 70

# JSON output
legible openapi.json --json

# Markdown output (for PR comments)
legible openapi.json --format markdown

# Generate badge SVG
legible openapi.json --badge badge.svg

# Exit codes: 0 = pass, 1 = below min, 2 = bad input
```

### GitHub Actions

Using the composite action:

```yaml
- uses: Athiradhkp04/legible@main
  with:
    spec: openapi.json
    min-score: 70
```

Or using npx:

```yaml
- run: npx legible-api openapi.json --min 70
```

### MCP Server

Add to Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "legible": {
      "command": "npx",
      "args": ["-y", "legible-api", "legible-mcp"]
    }
  }
}
```

The MCP server provides two tools:
- `score_openapi`: Full scoring with all checks
- `list_fixes`: Only failing checks for quick review

### Badge

Add to your README:

```markdown
[![agent-ready](https://img.shields.io/badge/agent--ready-85%2F100-2e9e5b)](https://athiradhkp04.github.io/legible/)
```

Generate locally:

```bash
legible openapi.json --badge badge.svg
```

## Scoring

The score (0-100) is based on 9 checks:

| Check | Weight | Description |
|-------|--------|-------------|
| Descriptions | 20 | Operations have summary and description |
| Operation IDs | 10 | Unique, verb-first operationIds |
| Parameters | 15 | All parameters described |
| Errors | 15 | 4xx/5xx responses documented with schemas |
| Responses | 10 | 2xx responses have schemas |
| Examples | 10 | Request/response examples included |
| Auth | 10 | Security schemes declared |
| Idempotency | 5 | POST/PATCH support retry |
| Info | 5 | API description and server URL |

## Development

```bash
# Run tests
npm test

# Batch scoring (for calibration)
node scripts/batch.js /path/to/openapi-directory
```

## License

MIT
