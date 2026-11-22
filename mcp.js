#!/usr/bin/env node
// Minimal MCP server over stdio (no SDK, no deps). Tools: score_openapi, list_fixes
const { run } = require('./cli.js');
const T = [
  { name: 'score_openapi', description: 'Score an OpenAPI spec (URL, file path, or raw JSON/YAML) for AI-agent readiness. Returns a 0-100 score, grade, and a prioritized fix list.', inputSchema: { type: 'object', properties: { spec: { type: 'string', description: 'URL, file path, or raw spec text' } }, required: ['spec'] } },
  { name: 'list_fixes', description: 'List only the failing checks for an OpenAPI spec. Returns a concise list of fixes needed.', inputSchema: { type: 'object', properties: { spec: { type: 'string', description: 'URL, file path, or raw spec text' } }, required: ['spec'] } }
];
const send = o => process.stdout.write(JSON.stringify(o) + '\n');
require('readline').createInterface({ input: process.stdin }).on('line', async l => {
  let m; try { m = JSON.parse(l); } catch (e) { return; }
  const id = m.id;
  if (m.method === 'initialize') send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'legible', version: '0.1.0' } } });
  else if (m.method === 'tools/list') send({ jsonrpc: '2.0', id, result: { tools: T } });
  else if (m.method === 'tools/call') {
    try {
      const result = await run(m.params.arguments.spec);
      if (m.params.name === 'list_fixes') {
        // Return only failing checks
        const failing = result.checks.filter(c => c.pct < 1).map(c => ({ check: c.label, fix: c.fix, where: c.where }));
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(failing, null, 2) }] } });
      } else {
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
      }
    }
    catch (e) { send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: String(e.message) }] } }); }
  } else if (id !== undefined) send({ jsonrpc: '2.0', id, result: {} });
});
