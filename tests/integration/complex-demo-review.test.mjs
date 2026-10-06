import test from 'node:test';
import assert from 'node:assert/strict';
import { complexDemoMR, complexDemoSnapshot } from '../../src/lib/complex-demo-review.js';
import { buildGraph } from '../../src/lib/review-model.mjs';
import { buildReviewFlows, scopeReviewGraph } from '../../src/lib/review-flows.mjs';

test('Complex demo has truthful counts, valid source lines and complete review coverage', () => {
  const snapshot = complexDemoSnapshot();
  const { files, demoGuide, mr } = snapshot;
  assert.equal(files.length, 30);
  assert.equal(new Set(files.map(file => file.path)).size, 30);
  assert.equal(complexDemoMR.added, files.flatMap(file => file.rows).filter(row => row.kind === 'added').length);
  assert.equal(complexDemoMR.removed, files.flatMap(file => file.rows).filter(row => row.kind === 'removed').length);
  for (const sha of Object.values(mr.diff_refs)) assert.match(sha, /^[a-f0-9]{40}$/);
  for (const file of files) {
    const displayed = file.rows.filter(row => row.newLine !== null);
    assert.deepEqual(displayed.map(row => row.text), file.content ? file.content.split('\n') : []);
    assert.deepEqual(displayed.map(row => row.newLine), displayed.map((_, i) => i + 1));
  }
  for (const item of [...demoGuide.findings, ...demoGuide.readingOrder]) {
    const file = files.find(file => file.path === item.path);
    assert.ok(file?.rows.some(row => row.newLine === item.line), item.path);
  }
  for (const step of demoGuide.sequence) {
    const content = files.find(file => file.path === step.path).content;
    assert.match(content.split('\n')[step.line - 1], /\bthis\.\w+\.\w+\(/);
  }
  const graph = buildGraph(files), flows = buildReviewFlows(files, graph);
  assert.deepEqual(flows.slice(0, 3).map(flow => flow.label), ['capture', 'reconciliation', 'webhooks']);
  assert.deepEqual(flows.flatMap(flow => flow.paths).sort(), files.map(file => file.path).sort());
  for (const label of ['capture', 'webhooks', 'reconciliation']) {
    const flow = flows.find(flow => flow.label === label);
    assert.ok(flow?.paths.length >= 6);
    assert.ok(flow.sharedPaths.length >= 3);
    const scoped = scopeReviewGraph(graph, flow);
    assert.ok(scoped.sequence.length >= 5, label);
    assert.ok(scoped.dependencies.every(edge => edge.evidence === 'code'), label);
  }
  assert.ok(files.some(file => file.deleted_file && file.path.includes('legacy')));
});
