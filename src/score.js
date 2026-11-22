// legible core: score an OpenAPI 2/3 object for AI-agent readiness. Zero deps, browser + Node.
(function (g) {
  const M = ['get', 'post', 'put', 'patch', 'delete'];
  
  // Resolve local $ref paths (e.g., "#/components/schemas/User") with cycle detection.
  // Returns the resolved object or the original value if not a ref or resolution fails.
  // pathStack tracks the resolution chain to detect cycles.
  function resolveRef(obj, spec, pathStack = []) {
    if (!obj || typeof obj !== 'object') return obj;
    if (obj.$ref && typeof obj.$ref === 'string') {
      const ref = obj.$ref;
      if (!ref.startsWith('#/')) return obj; // Only resolve local refs
      if (pathStack.includes(ref)) return obj; // Cycle detected, return original
      
      const parts = ref.substring(2).split('/');
      let cur = spec;
      for (const part of parts) {
        if (!cur || typeof cur !== 'object') return obj;
        cur = cur[part];
      }
      if (!cur || typeof cur !== 'object') return obj;
      // Recursively resolve the target, tracking the path to prevent cycles
      return resolveRef(cur, spec, [...pathStack, ref]);
    }
    return obj;
  }
  
  // Helper to resolve all refs in an object (for arrays of parameters, etc.)
  function resolveRefsInArray(arr, spec) {
    if (!Array.isArray(arr)) return arr;
    return arr.map(item => resolveRef(item, spec));
  }
  
  function score(spec) {
    const ops = [];
    for (const [p, it] of Object.entries((spec && spec.paths) || {}))
      for (const m of M) if (it && it[m]) ops.push({ k: m.toUpperCase() + ' ' + p, m, o: it[m], sh: resolveRefsInArray(it.parameters || [], spec) });
    const n = ops.length;
    if (!n) return { error: 'No operations found under "paths". Is this an OpenAPI 2/3 spec?' };
    const r = f => ops.filter(f).length / n;
    const miss = f => ops.filter(x => !f(x)).slice(0, 5).map(x => x.k);
    const ps = x => [...x.sh, ...resolveRefsInArray(x.o.parameters || [], spec)];
    const rs = x => Object.entries(x.o.responses || {});
    const dsc = x => ((x.o.description || '') + (x.o.summary || '')).length >= 20;
    const ids = ops.map(x => x.o.operationId).filter(Boolean);
    const par = x => ps(x).every(p => {
      const resolved = resolveRef(p, spec);
      return resolved.description || resolved.$ref;
    });
    const err = x => rs(x).some(([c]) => /^[45]|default/.test(c));
    const okS = x => rs(x).some(([c, v]) => {
      const resolved = resolveRef(v, spec);
      return /^2/.test(c) && (c === '204' || resolved.schema || resolved.$ref || (resolved.content && Object.values(resolved.content).some(t => t.schema)));
    });
    const ex = x => {
      // Check for examples in the operation, including resolved refs
      const checkExamples = (obj) => {
        if (!obj || typeof obj !== 'object') return false;
        if (obj.example !== undefined) return true;
        if (obj.examples !== undefined && typeof obj.examples === 'object') return true;
        // Check in content media types
        if (obj.content) {
          for (const mt of Object.values(obj.content)) {
            if (mt.example !== undefined || (mt.examples && typeof mt.examples === 'object')) return true;
          }
        }
        return false;
      };
      if (checkExamples(x.o)) return true;
      // Check parameters for examples
      for (const p of ps(x)) {
        const resolved = resolveRef(p, spec);
        if (checkExamples(resolved)) return true;
      }
      // Check responses for examples
      for (const [c, v] of rs(x)) {
        const resolved = resolveRef(v, spec);
        if (checkExamples(resolved)) return true;
      }
      return false;
    };
    const mut = ops.filter(x => x.m === 'post' || x.m === 'patch');
    const idem = x => ps(x).some(p => {
      const resolved = resolveRef(p, spec);
      return /idempotency/i.test(resolved.name || '');
    }) || x.o['x-idempotent'] !== undefined || /idempoten/i.test(x.o.description || '');
    const sec = (spec.components && spec.components.securitySchemes) || spec.securityDefinitions || {};
    const info = ((spec.info && spec.info.description) || '').length >= 50 ? 0.5 : 0;
    const srv = (spec.servers && spec.servers.length) || spec.host ? 0.5 : 0;
    // Swagger 2.0: consumes/produces are global; OpenAPI 3.0: per-operation in requestBody/response content
    // We don't score this explicitly as it's less critical for AI agents than schemas
    const C = [
      ['descriptions', 20, 'Operations say what they do', r(dsc), 'Give every operation a summary and a description. Agents choose tools from this text.', miss(dsc)],
      ['operationIds', 10, 'Unique operation names', Math.min(ids.length, new Set(ids).size) / n, 'Add a unique, verb-first operationId (e.g. createInvoice). It becomes the tool name.', miss(x => x.o.operationId)],
      ['params', 15, 'Parameters are explained', r(par), 'Describe every parameter: meaning, format, allowed values.', miss(par)],
      ['errors', 15, 'Errors are documented', r(err), 'Document 4xx/5xx responses with a schema. Agents recover only from errors they can read.', miss(err)],
      ['responses', 10, 'Success responses have a schema', r(okS), 'Define a schema for every 2xx response so agents know what comes back.', miss(okS)],
      ['examples', 10, 'Examples included', r(ex), 'Add request/response examples. Agents copy the shape they see.', miss(ex)],
      ['auth', 10, 'Auth is declared', Object.keys(sec).length ? 1 : 0, 'Declare securitySchemes so agents know how to authenticate.', []],
      ['idempotency', 5, 'Safe to retry', mut.length ? mut.filter(idem).length / mut.length : 1, 'Agents retry. Accept an Idempotency-Key header on POST/PATCH and say so.', mut.filter(x => !idem(x)).slice(0, 5).map(x => x.k)],
      ['info', 5, 'API overview and server URL', info + srv, 'Add info.description (50+ chars) and a servers entry.', []]
    ].map(([id, weight, label, pct, fix, where]) => ({ id, weight, label, pct, fix, where }));
    const total = Math.round(C.reduce((a, c) => a + c.weight * c.pct, 0));
    const grade = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 50 ? 'C' : total >= 30 ? 'D' : 'F';
    
    // Calculate per-operation scores for worst offenders
    const opScores = ops.map(op => {
      let opScore = 0;
      if (dsc(op)) opScore += 20;
      if (op.o.operationId) opScore += 10;
      if (par(op)) opScore += 15;
      if (err(op)) opScore += 15;
      if (okS(op)) opScore += 10;
      if (ex(op)) opScore += 10;
      if (mut.includes(op) && idem(op)) opScore += 5;
      // Auth and info are global, not per-operation
      return { name: op.k, score: opScore };
    }).sort((a, b) => a.score - b.score).slice(0, 5);
    
    return { score: total, grade, operations: n, checks: C, worstOperations: opScores };
  }
  function badge(s) {
    const col = s >= 85 ? '#2e9e5b' : s >= 70 ? '#8bb02f' : s >= 50 ? '#d9a21b' : '#cc4b37';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="20" role="img" aria-label="agent-ready: ' + s + '"><rect width="96" height="20" fill="#0f1b2d"/><rect x="96" width="54" height="20" fill="' + col + '"/><g fill="#fff" font-family="Verdana,sans-serif" font-size="11"><text x="8" y="14">agent-ready</text><text x="104" y="14">' + s + '/100</text></g></svg>';
  }
  const api = { score, badge };
  if (typeof module !== 'undefined') module.exports = api; else g.Legible = api;
})(this);
