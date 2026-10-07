import test from 'node:test';
import assert from 'node:assert/strict';
import { dependencyRoutes, crossesBox, sequenceMessage, roundedRail, fitDiagramText } from '../../src/lib/review-diagram-layout.mjs';
import { architectureLayout } from '../../src/lib/review-architecture.mjs';

const layout = points => ({ positions: new Map(points), nodeW: 204, nodeH: 64, width: 500, height: 500 });
function validate(routes, l) {
  for (const r of routes) {
    assert.equal(r.unavailable, false);
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i];
      assert.ok(a.x === b.x || a.y === b.y, 'Every rail is orthogonal');
      for (const [id, box] of l.positions) if (id !== r.edge.from && id !== r.edge.to)
        assert.equal(crossesBox(a, b, { ...box, w: l.nodeW, h: l.nodeH }), false, `Connection must not cross ${id}`);
    }
    for (const p of r.points) assert.ok(p.x >= 0 && p.x <= l.width && p.y >= 0 && p.y <= l.height);
  }
}
test('Skipped ranks, reverse edges, fan-in and same-row connections avoid unrelated components', () => {
  const l = layout([['a', { x: 40, y: 40 }], ['b', { x: 40, y: 180 }], ['c', { x: 40, y: 320 }], ['d', { x: 284, y: 180 }]]);
  const graph = { dependencies: [{ from: 'a', to: 'c' }, { from: 'c', to: 'a' }, { from: 'b', to: 'd' }, { from: 'd', to: 'c' }, { from: 'b', to: 'c' }] };
  const original = structuredClone(graph);
  const routes = dependencyRoutes(graph, l);
  assert.equal(routes.length, graph.dependencies.length);
  validate(routes, l);
  assert.deepEqual(graph, original);
  assert.ok(routes[0].points.some(p => p.x < 40 || p.x > 244));
  const incoming = routes.filter(r => r.edge.to === 'c').map(r => r.points.at(-1).x);
  assert.equal(new Set(incoming).size, incoming.length, 'Shared targets have distinct attach points');
});
test('A self dependency is a visible loop outside its component, not a zero-length rail', () => {
  const l = layout([['a', { x: 40, y: 40 }]]);
  const routes = dependencyRoutes({ dependencies: [{ from: 'a', to: 'a' }] }, l);
  validate(routes, l);
  assert.ok(routes[0].points.length >= 4);
  assert.notDeepEqual(routes[0].points[0], routes[0].points.at(-1));
});
test('A large layered graph preserves every connection and source reference', () => {
  const nodes = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, path: `n${i}`, role: i < 10 ? 'controller' : i < 20 ? 'service' : 'repository' }));
  const graph = { nodes, dependencies: nodes.slice(0, 20).flatMap((n, i) => [{ from: n.id, to: `n${i + 10}`, path: n.path, line: i + 1 }, { from: n.id, to: `n${20 + i % 10}`, path: n.path, line: i + 2 }]) };
  const l = architectureLayout(graph, { columns: 2 });
  const routes = dependencyRoutes(graph, l);
  validate(routes, l);
  assert.equal(routes.length, 40);
  assert.ok(routes.every((r, i) => r.edge === graph.dependencies[i]));
});
test('API components follow first source-call occurrence inside each role; generic groups keep stable path order', () => {
  const nodes = [{ id: 'audit', path: 'AuditService.ts', role: 'service', methods: [{ name: 'record' }] }, { id: 'payment', path: 'PaymentService.ts', role: 'service', methods: [{ name: 'capture' }] }, { id: 'entry', path: 'Controller.ts', role: 'controller', methods: [{ name: 'capture' }] }];
  const graph = { nodes, dependencies: [], sequence: [{ from: 'entry', to: 'payment' }, { from: 'payment', to: 'audit' }] };
  assert.deepEqual(architectureLayout(graph).layers[1].map(n => n.id), ['payment', 'audit']);
  assert.deepEqual(architectureLayout({ ...graph, nodes: nodes.map(({ methods, ...n }) => n) }).layers[1].map(n => n.id), ['audit', 'payment']);
});
test('Sequence labels keep source evidence distinct from suggestions and retain method names rather than AST offsets', () => {
  const step = { label: 'Controller.capture → Service.capture() · if', toMethod: 'src/Service.ts#PaymentService.capture:180', evidence: 'code' };
  assert.deepEqual(sequenceMessage(step, 2), { label: '2. capture()', evidence: 'source call', kind: 'resolved' });
  assert.equal(sequenceMessage({ ...step, deferred: true }, 2).kind, 'deferred');
  assert.equal(sequenceMessage({ label: 'const capture = await this.captureRepository.save(tx, request);' }, 6).label, '6. save()');
  const suggested = sequenceMessage({ label: 'A very long suggested interaction with a speculative sequence' }, 1, 30);
  assert.equal(suggested.evidence, 'inferred');
  assert.equal(suggested.kind, 'inferred');
  assert.equal(suggested.label.length, 30);
});

test('Crossing rails get one bridge rather than implying an accidental junction', () => {
  const points = [{ x: 20, y: 80 }, { x: 140, y: 80 }];
  const crossings = [[{ x: 80, y: 20 }, { x: 80, y: 140 }]];
  const d = roundedRail(points, crossings);
  assert.match(d, /L 76 80 a 4 4 0 0 1 8 0/);
  assert.equal((d.match(/ a /g) || []).length, 1);
  assert.equal(roundedRail(points), 'M 20 80 L 140 80');
});

test('Korean, mixed identifiers and combining characters keep a readable size within the label budget', () => {
  assert.equal(fitDiagramText('결제승인요청검증및처리서비스', 140, 13), '결제승인요청검증및…');
  assert.equal(fitDiagramText('결제 v2.1', 100, 12), '결제 v2.1');
  assert.equal(fitDiagramText('Cafe\u0301', 29, 12), 'Cafe\u0301');
  assert.equal(fitDiagramText('PaymentService', 140), 'PaymentService');
});
