#!/usr/bin/env node
const fs = require('fs');
const { score, badge } = require('./src/score.js');
async function load(src) {
  let t = /^https?:\/\//.test(src) ? await (await fetch(src)).text() : fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : src;
  try { return JSON.parse(t); } catch (e) {}
  try { return require('js-yaml').load(t); } catch (e) { throw new Error('Could not parse as JSON. For YAML run: npm i js-yaml'); }
}
async function run(src) { return score(await load(src)); }
module.exports = { run, load };
if (require.main === module) (async () => {
  const a = process.argv.slice(2), src = a.find(x => !x.startsWith('--') && a[a.indexOf(x) - 1] !== '--min' && a[a.indexOf(x) - 1] !== '--badge' && a[a.indexOf(x) - 1] !== '--format');
  const opt = k => (a.indexOf(k) > -1 ? a[a.indexOf(k) + 1] : null);
  if (!src) return console.log('usage: legible <spec file|url> [--min 70] [--json] [--format markdown] [--badge out.svg]');
  const r = await run(src);
  if (r.error) { console.error(r.error); process.exit(2); }
  if (opt('--badge')) fs.writeFileSync(opt('--badge'), badge(r.score));
  const format = opt('--format') || 'text';
  if (a.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else if (format === 'markdown') {
    console.log('## Legible Agent-Readiness Score\n');
    console.log('**Score:** ' + r.score + '/100 (Grade: ' + r.grade + ')  \n');
    console.log('**Operations:** ' + r.operations + '\n');
    const failing = r.checks.filter(c => c.pct < 1);
    if (failing.length > 0) {
      console.log('### Fixes Needed\n');
      failing.forEach(c => {
        console.log('**' + c.label + '** (' + Math.round(c.pct * 100) + '%)  \n');
        console.log(c.fix + '  \n');
        if (c.where.length) console.log('e.g. ' + c.where.join(', ') + '  \n');
      });
    }
  }
  else {
    console.log('Agent-readiness: ' + r.score + '/100 (' + r.grade + ') across ' + r.operations + ' operations\n');
    r.checks.forEach(c => { console.log(Math.round(c.pct * 100).toString().padStart(3) + '%  ' + c.label); if (c.pct < 1) console.log('      fix: ' + c.fix + (c.where.length ? '\n      e.g. ' + c.where.join(', ') : '')); });
  }
  if (opt('--min') && r.score < +opt('--min')) process.exit(1);
})();
