import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeApiFlows } from '../../src/lib/review-api-flows.mjs';
import { classifyReviewFile, annotateReviewGraph, architectureLayout } from '../../src/lib/review-architecture.mjs';
import { mixedDemoFiles } from '../../src/lib/mixed-demo-review.js';
import { buildReviewFlows } from '../../src/lib/review-flows.mjs';
const file = (path, content, contextOnly = false) => ({ path, content, contextOnly, rows: [], diff: '' });
test('mixed PR separates Kafka, API, schedule and core paths without dropping contracts or support changes', async () => {
  const r = await analyzeApiFlows(mixedDemoFiles);
  assert.deepEqual(r.flows.map(f => f.kind), ['kafka', 'api', 'scheduled', 'core']);
  assert.equal(r.flows[3].title, 'Core · money.convertCurrency()');
  assert.equal(r.flows[3].ranges.length, 2);
  const kafka = r.flows[0], schedule = r.flows[2];
  assert.ok(kafka.trigger.detail.includes('payments.captured.v2'));
  assert.ok(kafka.ranges.some(r => r.name === 'settle'));
  assert.ok(!kafka.ranges.some(r => r.name === 'capture' || r.name === 'reconcile'));
  assert.ok(schedule.ranges.some(r => r.name === 'pending'));
  assert.ok(!schedule.ranges.some(r => r.name === 'save' || r.name === 'publish'));
  assert.ok(kafka.boundaries.some(b => /Dispatch helper/.test(b.reason)));
  const fallback = buildReviewFlows(mixedDemoFiles.filter(f => !r.consumedPaths.includes(f.path)), {});
  const all = new Set([...r.flows, ...fallback].flatMap(f => f.paths));
  assert.ok(mixedDemoFiles.every(f => all.has(f.path)));
});
test('data contracts have distinct layers and type edges but never fake sequence calls', async () => {
  const r = await analyzeApiFlows(mixedDemoFiles), flow = r.flows[0];
  const graph = annotateReviewGraph(flow.graph, r.contextFiles);
  const roles = new Set(graph.nodes.map(n => n.role));
  for (const role of ['consumer', 'service', 'domainservice', 'domain', 'persistenceadapter', 'repository', 'producer', 'port', 'dto', 'entity', 'model']) assert.ok(roles.has(role), role);
  assert.ok(flow.contracts.length >= 5);
  for (const path of flow.contracts) {
    assert.ok(graph.dependencies.some(e => e.to === path && e.evidence === 'type'));
    assert.ok(!graph.sequence.some(e => e.from === path || e.to === path));
  }
  const layout = architectureLayout(graph);
  for (const point of layout.positions.values()) assert.ok(point.y + layout.nodeH <= layout.height);
});
test('Kafka transport requires explicit imported Transport.KAFKA; generic message handlers stay messaging', async () => {
  const source = `import {EventPattern as E, Transport as T} from '@nestjs/microservices'; class Consumer { @E('orders', T.KAFKA) receive() { return 1; } }`;
  assert.equal((await analyzeApiFlows([file('C.ts', source)])).flows[0].kind, 'kafka');
  assert.equal((await analyzeApiFlows([file('C.ts', source.replace(', T.KAFKA', ''))])).flows[0].kind, 'message');
  assert.equal((await analyzeApiFlows([file('C.ts', source.replace('@nestjs/microservices', './fake'))])).flows[0].kind, 'core');
});
test('Spring Kafka and Scheduled recognize qualified imports and preserve declared topics and timing', async () => {
  const sources = [file('p/C.java', `package p; import org.springframework.kafka.annotation.KafkaListener; import org.springframework.scheduling.annotation.Scheduled; class C { @KafkaListener(topics={"a", "b"}, groupId="settlement") public String receive() { return "ok"; } @Scheduled(fixedDelay=15000) public void reconcile() { receive(); } }`)];
  const r = await analyzeApiFlows(sources);
  assert.deepEqual(r.flows.map(f => f.kind), ['kafka', 'scheduled']);
  assert.ok(r.flows[0].trigger.detail.includes('groupId'));
  const fake = await analyzeApiFlows([file('C.java', 'import fake.KafkaListener; class C { @KafkaListener(topics="a") void run() {} }')]);
  assert.equal(fake.flows[0].kind, 'core');
});
test('core imported functions resolve lexical calls without inventing class dispatch or shadowed imports', async () => {
  const helper = file('core/round.ts', 'export function round(value: number) { return Math.round(value); }', true);
  const source = "import {round as r} from './round'; export function convert(value: number) { return r(value); }";
  const r = await analyzeApiFlows([file('core/money.ts', source), helper]);
  assert.equal(r.flows.length, 1); assert.equal(r.flows[0].ranges.length, 2);
  const shadowed = await analyzeApiFlows([file('core/money.ts', source.replace('convert(value: number)', 'convert(value: number, r: Function)')), helper]);
  assert.equal(shadowed.flows[0].ranges.length, 1);
  assert.ok(shadowed.flows[0].boundaries.some(b => b.name === 'r'));
});
test('architecture conventions refine generic stereotypes and support both adaptor spellings without guessing everything', () => {
  const cases = { 'PaymentController.java':'controller', 'PaymentService.java':'service', 'PaymentDomainService.java':'domainservice', 'PaymentAdaptor.java':'adapter', 'PaymentPersistentAdaptor.java':'persistenceadapter', 'PaymentPersistenceAdapter.java':'persistenceadapter', 'PaymentRepository.java':'repository', 'PaymentDto.java':'dto', 'PaymentModel.java':'model', 'PaymentEntity.java':'entity', 'domain/Payment.java':'domain', 'domain/service/PaymentService.java':'domainservice', 'PaymentPort.java':'port' };
  for (const [path, role] of Object.entries(cases)) assert.equal(classifyReviewFile({path}).role, role, path);
  assert.equal(classifyReviewFile(file('PaymentDomainService.java', '@Service\nclass PaymentDomainService {}')).role, 'domainservice');
  assert.equal(classifyReviewFile(file('PaymentPersistenceAdapter.java', '@Repository\nclass PaymentPersistenceAdapter {}')).role, 'persistenceadapter');
  assert.equal(classifyReviewFile({path:'Mystery.java'}).confidence, 'unknown');
});

test('destructured lexical shadowing and type-only imports cannot become executable function links', async () => {
  const helper = file('round.ts', 'export function round(n: number) { return n; }', true);
  for (const source of ["import {round} from './round'; export function convert({round}: {round: Function}) { return round(1); }", "import type {round} from './round'; export function convert() { return round(1); }"] ) {
    const r = await analyzeApiFlows([file('money.ts', source), helper]);
    assert.equal(r.flows[0].ranges.length, 1);
    assert.ok(r.flows[0].boundaries.some(b => b.name === 'round'));
  }
  assert.equal(classifyReviewFile({path:'src/core/money.ts'}).role, 'core');
  assert.equal(classifyReviewFile(file('adapter/out/persistence/PaymentService.java', '@Service\nclass PaymentService {}')).role, 'persistenceadapter');
});

test('dotted, dashed and directory persistence adapter/adaptor conventions remain specific', () => {
  for (const path of ['payment.persistence.adapter.ts','payment.persistent.adaptor.ts','payment-persistence-adapter.ts','persistent-adapters/Payment.ts','persistence-adaptors/Payment.ts','adapters/out/persistence/Payment.ts']) assert.equal(classifyReviewFile({path}).role, 'persistenceadapter', path);
});
