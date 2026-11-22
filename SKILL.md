---
name: legible-api-audit
description: Score an OpenAPI spec for AI-agent readiness (0-100) and list the exact fixes. Use when asked to review, lint, or improve an API so agents and MCP tools can use it.
---
Run: `node cli.js <spec path or url> --json`. Report the score, grade, and each failing check with its fix and example operations. Offer to apply the fixes to the spec, then re-run to show the new score.
