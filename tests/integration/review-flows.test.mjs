import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewFlows, scopeReviewGraph } from '../../src/lib/review-flows.mjs';

const files = paths => paths.map(path => ({ path, old_path: path, new_path: path, diff: '', rows: [] }));
const graph = (paths, links = []) => ({ nodes: paths.map(path => ({ id: path, path })),
  dependencies: links.map(([from, to, evidence = 'code']) => ({ from, to, evidence, path: from, line: 1 })), sequence: [] });
function completePartition(flows, paths) {
  const primary = flows.flatMap(flow => flow.paths);
  assert.deepEqual([...primary].sort(), [...new Set(paths)].sort());
  assert.equal(new Set(primary).size, primary.length);
  assert.equal(new Set(flows.map(flow => flow.id)).size, flows.length);
  assert.ok(flows.every(flow => flow.paths.length > 0 && flow.paths.length <= 12));
}

test('one cohesive small change keeps source, uniquely named tests, and configuration together', () => {
  const paths = ['src/controllers/PaymentController.ts', 'src/services/PaymentService.ts', 'tests/PaymentService.test.ts', 'package.json'];
  const flows = buildReviewFlows(files(paths), graph(paths, [[paths[0], paths[1]]]));
  assert.equal(flows.length, 1);
  assert.equal(flows[0].kind, 'flow');
  completePartition(flows, paths);
});

test('two unrelated feature areas split even in a four-file review', () => {
  const paths = ['src/features/payments/api.ts', 'src/features/payments/retry.ts', 'src/features/orders/api.ts', 'src/features/orders/state.ts'];
  const flows = buildReviewFlows(files(paths), graph(paths, [[paths[0], paths[1]], [paths[2], paths[3]]]));
  assert.equal(flows.length, 2);
  assert.deepEqual(flows.map(flow => flow.paths.length), [2, 2]);
  assert.ok(flows.find(flow => flow.label === 'payments'));
  assert.ok(flows.find(flow => flow.label === 'orders'));
  completePartition(flows, paths);
});

test('common utility hubs never fuse independent areas and are counted only once', () => {
  const paths = ['src/features/payments/api.ts', 'src/features/orders/api.ts', 'src/shared/logger.ts'];
  const g = graph(paths, [[paths[0], paths[2]], [paths[1], paths[2]]]);
  const flows = buildReviewFlows(files(paths), g);
  assert.equal(flows.length, 3);
  const utility = flows.find(flow => flow.label === 'Shared code');
  assert.deepEqual(utility.paths, [paths[2]]);
  for (const flow of flows.filter(flow => flow !== utility)) assert.deepEqual(flow.sharedPaths, [paths[2]]);
  completePartition(flows, paths);
});

test('directory boundaries survive cross-feature imports without hiding cross-group edges', () => {
  const paths = ['src/payments/retry.ts', 'src/orders/state.ts'];
  const g = graph(paths, [[paths[0], paths[1]]]);
  const flows = buildReviewFlows(files(paths), g);
  assert.equal(flows.length, 2);
  const scoped = scopeReviewGraph(g, flows.find(flow => flow.paths.includes(paths[0])));
  assert.equal(scoped.nodes.length, 1);
  assert.equal(scoped.dependencies.length, 0);
  assert.deepEqual(scoped.boundaryDependencies, g.dependencies);
  completePartition(flows, paths);
});

test('large connected cycles split into bounded deterministic groups with transparent labels', () => {
  const paths = Array.from({ length: 31 }, (_, index) => `src/features/payments/component-${String(index).padStart(2, '0')}.ts`);
  const links = paths.map((path, index) => [path, paths[(index + 1) % paths.length]]);
  const g = graph(paths, links);
  const flows = buildReviewFlows(files(paths), g);
  assert.equal(flows.length, 3);
  assert.ok(flows.every(flow => /part \d of 3/.test(flow.label) && /at most 12/.test(flow.reason)));
  assert.deepEqual(buildReviewFlows(files([...paths].reverse()), { ...g, dependencies: [...g.dependencies].reverse(), nodes: [...g.nodes].reverse() }), flows);
  completePartition(flows, paths);
});

test('AI or inferred topology cannot change initial grouping or its identifiers', () => {
  const paths = ['src/payments/retry.ts', 'src/orders/state.ts', 'docs/review.md'];
  const original = graph(paths);
  const augmented = { ...original, dependencies: [...original.dependencies, { from: paths[0], to: paths[1], evidence: 'inferred' }],
    sequence: [{ from: paths[0], to: paths[1], evidence: 'inferred' }] };
  assert.deepEqual(buildReviewFlows(files(paths), augmented), buildReviewFlows(files(paths), original));
});

test('renamed, deleted, unavailable, empty-diff and duplicate-basename files all have a primary owner', () => {
  const input = [
    { path: 'src/payments/index.ts', old_path: 'src/payments/old.ts', new_path: 'src/payments/index.ts', renamed_file: true },
    { path: 'src/orders/index.ts', old_path: 'src/orders/index.ts', deleted_file: true },
    { path: 'src/payments/large.bin', unavailable: true, diff: '', rows: [] },
    { new_path: 'tests/index.spec.ts', diff: '' },
    { old_path: 'docs/deleted.md', deleted_file: true },
    { path: '.github/workflows/test.yml', diff: '' },
  ];
  const paths = input.map(file => file.path || file.new_path || file.old_path);
  const flows = buildReviewFlows(input, graph(paths, [['src/payments/old.ts', 'src/payments/large.bin']]));
  completePartition(flows, paths);
  const payments = flows.find(flow => flow.paths.includes('src/payments/index.ts'));
  assert.ok(payments.paths.includes('src/payments/large.bin'));
  assert.ok(!payments.paths.includes('src/orders/index.ts'));
  // An ambiguous test basename is a visible fallback group, not arbitrarily attached.
  assert.equal(flows.find(flow => flow.paths.includes('tests/index.spec.ts')).label, 'Tests');
  assert.ok(flows.find(flow => flow.paths.includes('docs/deleted.md')));
});

test('connected components without feature directories remain distinct when imports provide evidence', () => {
  const paths = ['src/A.ts', 'src/B.ts', 'src/C.ts', 'src/D.ts'];
  const flows = buildReviewFlows(files(paths), graph(paths, [[paths[0], paths[1]], [paths[2], paths[3]]]));
  assert.equal(flows.length, 2);
  assert.deepEqual(flows.map(flow => flow.paths), [paths.slice(0, 2), paths.slice(2)]);
});

test('scope includes related shared files, only internal edges, and separate boundary evidence', () => {
  const paths = ['src/payments/api.ts', 'src/orders/api.ts', 'src/shared/logger.ts'];
  const g = graph(paths, [[paths[0], paths[2]], [paths[1], paths[2]]]);
  g.sequence = g.dependencies.map(edge => ({ ...edge, evidence: 'inferred' }));
  const flow = buildReviewFlows(files(paths), g).find(item => item.paths.includes(paths[0]));
  const before = structuredClone(g);
  const scoped = scopeReviewGraph(g, flow);
  assert.deepEqual(scoped.nodes.map(node => node.path), [paths[0], paths[2]]);
  assert.deepEqual(scoped.dependencies, [g.dependencies[0]]);
  assert.deepEqual(scoped.sequence, [g.sequence[0]]);
  assert.deepEqual(scoped.boundaryDependencies, [g.dependencies[1]]);
  assert.deepEqual(scoped.boundarySequence, [g.sequence[1]]);
  assert.deepEqual(g, before);
});

test('empty input is safe and duplicate records do not duplicate progress', () => {
  assert.deepEqual(buildReviewFlows([], {}), []);
  assert.deepEqual(scopeReviewGraph({}, null), { nodes: [], dependencies: [], sequence: [], boundaryDependencies: [], boundarySequence: [] });
  const input = files(['src/a.ts', 'src/a.ts', 'src/b.ts']);
  completePartition(buildReviewFlows(input, graph(['src/a.ts', 'src/b.ts'])), ['src/a.ts', 'src/b.ts']);
});

test('documentation and configuration only changes have understandable fallback labels', () => {
  assert.equal(buildReviewFlows(files(['docs/overview.md', 'README.md']), {}).at(0).label, 'Documentation');
  assert.equal(buildReviewFlows(files(['package.json', '.github/workflows/ci.yml']), {}).at(0).label, 'Configuration');
  const flows = buildReviewFlows(files(Array.from({ length: 26 }, (_, index) => `docs/page-${index}.md`)), {});
  assert.equal(flows.length, 3);
  assert.ok(flows.every(flow => flow.label.startsWith('Documentation · part')));
});

test('many shared hubs keep every diagram bounded while remaining primarily owned and reachable', () => {
  const features = ['src/features/payments/api.ts', 'src/features/orders/api.ts'];
  const shared = Array.from({ length: 27 }, (_, index) => `src/shared/helper-${String(index).padStart(2, '0')}.ts`);
  const paths = [...features, ...shared];
  const g = graph(paths, features.flatMap(feature => shared.map(path => [feature, path])));
  const flows = buildReviewFlows(files(paths), g);
  completePartition(flows, paths);
  for (const flow of flows) {
    assert.ok(flow.sharedPaths.length <= 6);
    assert.ok(scopeReviewGraph(g, flow).nodes.length <= 18);
  }
  const payment = flows.find(flow => flow.paths.includes(features[0]));
  assert.deepEqual(payment.sharedPaths, shared.slice(0, 6));
  const scoped = scopeReviewGraph(g, payment);
  for (const path of shared.slice(6)) {
    assert.ok(scoped.boundaryDependencies.some(edge => edge.from === features[0] && edge.to === path));
    assert.ok(flows.some(flow => flow.paths.includes(path)));
  }
  assert.deepEqual(buildReviewFlows(files([...paths].reverse()), { ...g, dependencies: [...g.dependencies].reverse() }), flows);
});

test('hundreds of source and test files retain complete bounded coverage', () => {
  const source = Array.from({ length: 400 }, (_, index) => `src/features/catalog/Component${index}.ts`);
  const tests = source.map(path => `tests/${path.split('/').at(-1).replace('.ts', '.test.ts')}`);
  const paths = [...source, ...tests];
  const g = graph(paths, source.slice(1).map((path, index) => [path, source[index]]));
  const flows = buildReviewFlows(files(paths), g);
  completePartition(flows, paths);
  assert.equal(flows.length, Math.ceil(paths.length / 12));
  assert.deepEqual(buildReviewFlows(files([...paths].reverse()), g), flows);
});
