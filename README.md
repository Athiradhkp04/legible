# legible
Spell-check for APIs: scores an OpenAPI spec on how well AI agents can use it, and says exactly what to fix.

- **Web:** open `index.html` (deploy free on GitHub Pages). Paste a spec, get a score and fixes.
- **CLI:** `npx legible-api openapi.json --min 70` (exit 1 below the bar)
- **CI:** add `- run: npx legible-api openapi.json --min 70` to any GitHub Actions workflow
- **MCP:** `{"command":"npx","args":["-y","legible-api","legible-mcp"]}` in Claude/Cursor config
- **Agent skill:** `SKILL.md` (list it on Agensi next to searchlens)
- **Badge:** `legible spec.json --badge badge.svg`, then put it in your README
