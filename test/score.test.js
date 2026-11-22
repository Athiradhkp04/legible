const { test } = require('node:test');
const assert = require('node:assert');
const { score } = require('../src/score.js');
const fs = require('fs');
const path = require('path');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
}

test('good spec scores high', () => {
  const spec = loadFixture('good.json');
  const result = score(spec);
  assert.strictEqual(result.error, undefined);
  assert.strictEqual(result.operations, 2);
  assert.strictEqual(result.grade, 'A');
  assert(result.score >= 85);
});

test('bad spec scores low', () => {
  const spec = loadFixture('bad.json');
  const result = score(spec);
  assert.strictEqual(result.error, undefined);
  assert.strictEqual(result.operations, 2);
  assert.strictEqual(result.grade, 'F');
  assert(result.score < 50);
});

test('spec with $refs resolves correctly', () => {
  const spec = loadFixture('refs.json');
  const result = score(spec);
  assert.strictEqual(result.error, undefined);
  assert.strictEqual(result.operations, 1);
  // Should credit the ref'd parameter description
  const paramsCheck = result.checks.find(c => c.id === 'params');
  assert.strictEqual(paramsCheck.pct, 1);
  // Should credit the ref'd response schema
  const responsesCheck = result.checks.find(c => c.id === 'responses');
  assert.strictEqual(responsesCheck.pct, 1);
  // Should credit the ref'd example
  const examplesCheck = result.checks.find(c => c.id === 'examples');
  assert.strictEqual(examplesCheck.pct, 1);
});

test('Swagger 2.0 spec is supported', () => {
  const spec = loadFixture('swagger2.json');
  const result = score(spec);
  assert.strictEqual(result.error, undefined);
  assert.strictEqual(result.operations, 2);
  // Should recognize securityDefinitions
  const authCheck = result.checks.find(c => c.id === 'auth');
  assert.strictEqual(authCheck.pct, 1);
  // Should recognize host
  const infoCheck = result.checks.find(c => c.id === 'info');
  assert(infoCheck.pct > 0);
});

test('empty spec returns error', () => {
  const spec = loadFixture('empty.json');
  const result = score(spec);
  assert(result.error);
  assert(result.error.includes('No operations'));
});

test('cycle detection in $ref', () => {
  const spec = {
    openapi: '3.0.0',
    info: { title: 'Cycle Test', version: '1.0.0' },
    paths: {
      '/test': {
        get: {
          operationId: 'test',
          summary: 'Test',
          responses: {
            '200': {
              description: 'OK',
              schema: { '$ref': '#/components/schemas/Cycle' }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Cycle: { '$ref': '#/components/schemas/Cycle' }
      }
    }
  };
  const result = score(spec);
  assert.strictEqual(result.error, undefined);
  // Should not crash on cycle
  assert.strictEqual(result.operations, 1);
});
