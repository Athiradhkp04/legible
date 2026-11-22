#!/usr/bin/env node
// Calibration script: score all specs in openapi-directory and output CSV
const fs = require('fs');
const path = require('path');
const { score } = require('../src/score.js');

const dirPath = process.argv[2];
if (!dirPath) {
  console.error('Usage: node scripts/batch.js <path-to-openapi-directory>');
  process.exit(1);
}

const results = [];
const crashes = [];
const oddScores = [];

function walkDir(dir, baseApi = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // openapi-directory structure: APIs/<api>/<version>/openapi.yaml
      const relativePath = path.relative(dirPath, fullPath);
      const parts = relativePath.split(path.sep);
      if (parts.length === 1) {
        // This is an API directory
        walkDir(fullPath, entry.name);
      } else if (parts.length === 2 && baseApi) {
        // This is a version directory
        walkDir(fullPath, baseApi);
      } else {
        walkDir(fullPath, baseApi);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
        const relativePath = path.relative(dirPath, fullPath);
        const parts = relativePath.split(path.sep);
        // Extract API name and version from path
        let api = parts[0] || 'unknown';
        let version = parts[1] || 'unknown';
        
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          let spec;
          try {
            spec = JSON.parse(content);
          } catch (e) {
            // Try YAML if JSON fails
            try {
              spec = require('js-yaml').load(content);
            } catch (e2) {
              crashes.push({ file: relativePath, error: 'Could not parse as JSON or YAML' });
              return;
            }
          }
          
          const result = score(spec);
          if (result.error) {
            crashes.push({ file: relativePath, error: result.error });
          } else {
            // Check for odd scores (very low or very high)
            if (result.score < 10 || result.score === 100) {
              oddScores.push({ file: relativePath, score: result.score, operations: result.operations });
            }
            
            // Build CSV row
            const checkPcts = {};
            result.checks.forEach(c => {
              checkPcts[c.id] = Math.round(c.pct * 100);
            });
            
            results.push({
              api,
              version,
              operations: result.operations,
              score: result.score,
              grade: result.grade,
              ...checkPcts
            });
          }
        } catch (e) {
          crashes.push({ file: relativePath, error: e.message });
        }
      }
    }
  }
}

console.log(`Scanning ${dirPath}...`);
walkDir(dirPath);

console.log(`Found ${results.length} valid specs`);
console.log(`Crashes: ${crashes.length}`);
console.log(`Odd scores: ${oddScores.length}`);

// Output CSV
const checkIds = results.length > 0 ? Object.keys(results[0]).filter(k => !['api', 'version', 'operations', 'score', 'grade'].includes(k)) : [];
const header = ['api', 'version', 'operations', 'score', 'grade', ...checkIds];
const csv = [header.join(',')];
for (const r of results) {
  const row = header.map(h => r[h] !== undefined ? r[h] : '');
  csv.push(row.join(','));
}
fs.writeFileSync('results.csv', csv.join('\n'));
console.log('Wrote results.csv');

// Report score distribution
const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
for (const r of results) {
  distribution[r.grade]++;
}
console.log('\nScore distribution:');
console.log(`  A (85-100): ${distribution.A} (${(distribution.A / results.length * 100).toFixed(1)}%)`);
console.log(`  B (70-84):  ${distribution.B} (${(distribution.B / results.length * 100).toFixed(1)}%)`);
console.log(`  C (50-69):  ${distribution.C} (${(distribution.C / results.length * 100).toFixed(1)}%)`);
console.log(`  D (30-49):  ${distribution.D} (${(distribution.D / results.length * 100).toFixed(1)}%)`);
console.log(`  F (0-29):   ${distribution.F} (${(distribution.F / results.length * 100).toFixed(1)}%)`);

// Report crashes
if (crashes.length > 0) {
  console.log('\nCrashes (up to 10):');
  crashes.slice(0, 10).forEach(c => {
    console.log(`  ${c.file}: ${c.error}`);
  });
}

// Report odd scores
if (oddScores.length > 0) {
  console.log('\nOdd scores (up to 10):');
  oddScores.slice(0, 10).forEach(o => {
    console.log(`  ${o.file}: score=${o.score}, operations=${o.operations}`);
  });
}

// Check for uninformative checks (all ~0 or all ~100)
console.log('\nCheck statistics:');
for (const checkId of checkIds) {
  const values = results.map(r => r[checkId]);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const allZero = values.every(v => v === 0);
  const allHundred = values.every(v => v === 100);
  if (allZero || allHundred) {
    console.log(`  ${checkId}: UNINFORMATIVE (all ${allZero ? '0' : '100'})`);
  } else {
    console.log(`  ${checkId}: avg ${avg.toFixed(1)}%`);
  }
}
