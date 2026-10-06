import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, parseDiff } from '../../src/lib/review-model.mjs';
import { complexDemoSnapshot } from '../../src/lib/complex-demo-review.js';

const source = (path, content) => ({ path, content, diff: '', rows: [] });

test('sequence omits type declarations, comments, strings, tests and unresolved dynamic calls', () => {
  const content = `import { PaymentService } from './PaymentService';
import { PaymentRequest } from './PaymentRequest';
class Controller {
  constructor(private readonly service: PaymentService) {}
  async receive(request: PaymentRequest) {
    // this.service.capture(request);
    /*
    this.service.capture(request);
    */
    const example = "this.service.capture(request)";
    const template = \`this.service.capture(request)\`;
    const pattern = /PaymentService.capture()/;
    dynamicService.capture(request);
    return this.service.capture(request);
  }
}`;
  const graph = buildGraph([source('src/Controller.ts', content), source('src/PaymentService.ts', ''),
    source('src/PaymentRequest.ts', ''), source('src/Controller.test.ts', `import { PaymentService } from './PaymentService';\nPaymentService.capture();`),
    source('docs/example.md', 'PaymentService.capture(request);')]);
  assert.deepEqual(graph.sequence.map(step => [step.path, step.to, step.line]), [
    ['src/Controller.ts', 'src/PaymentService.ts', 14],
  ]);
  assert.equal(graph.sequence[0].evidence, 'inferred');
});

test('calls follow exact source lines rather than imported target order, including typed aliases', () => {
  const content = `import { Store } from './Store';
import { Verifier } from './Verifier';
class Handler {
  constructor(private readonly persistence: Store, private readonly check: Verifier) {}
  async run() {
    this.check.verify();
    this.persistence.save();
    this.check?.verify();
    return Store.flush();
  }
}`;
  const graph = buildGraph([source('src/Handler.ts', content), source('src/Store.ts', ''), source('src/Verifier.ts', '')]);
  assert.deepEqual(graph.sequence.map(step => [step.to, step.line]), [
    ['src/Verifier.ts', 6], ['src/Store.ts', 7], ['src/Verifier.ts', 8], ['src/Store.ts', 9],
  ]);
  for (const step of graph.sequence) assert.match(content.split('\n')[step.line - 1], /\(/);
});

test('resolved imported names support conventional filenames while ambiguous duplicate types stay omitted', () => {
  const content = `import { PaymentService as Checkout } from './payment.service';
class Handler {
  constructor(private readonly service: Checkout) {}
  run() { return this.service.capture(); }
}`;
  const graph = buildGraph([source('src/Handler.ts', content), source('src/payment.service.ts', ''),
    source('src/a/Store.ts', ''), source('src/b/Store.ts', ''), source('src/Unknown.ts', 'class Unknown { private readonly store: Store; run() { this.store.save(); } }')]);
  assert.deepEqual(graph.sequence.map(step => [step.path, step.to, step.line]), [['src/Handler.ts', 'src/payment.service.ts', 4]]);
  const diff = '@@ -10,0 +10,2 @@\n+private final Store persistence;\n+void run() { this.persistence.save(); }';
  const java = buildGraph([{ path: 'src/Handler.java', diff, rows: parseDiff(diff) }, source('src/Store.java', '')]);
  assert.deepEqual(java.sequence.map(step => [step.to, step.line]), [['src/Store.java', 11]]);
});

test('large PR static sequence verifies webhook signatures first and never turns DTO signatures into calls', () => {
  const { files } = complexDemoSnapshot();
  const graph = buildGraph(files);
  assert.equal(graph.sequence.some(step => /(?:CaptureRequest|PaymentEvent|ReconciliationResult)\.ts$/.test(step.to)), false);
  const controller = graph.sequence.filter(step => step.path.endsWith('PaymentWebhookController.ts'));
  assert.deepEqual(controller.map(step => [step.to.split('/').at(-1), step.line]), [
    ['SignatureVerifier.ts', 11], ['PaymentWebhookService.ts', 12],
  ]);
  for (const path of new Set(graph.sequence.map(step => step.path))) {
    const lines = graph.sequence.filter(step => step.path === path).map(step => step.line);
    assert.deepEqual(lines, [...lines].sort((a, b) => a - b));
  }
});

test('later rollback interactions remain visible and an AI guide cannot replace detected source evidence', () => {
  const files = [source('src/Handler.ts', `import { Store } from './Store';
class Handler {
  constructor(private readonly persistence: Store) {}
  async run() {
    await this.persistence.open();
    await this.persistence.write();
    await this.persistence.commit();
    await this.persistence.rollback();
    await this.persistence.close();
  }
}`), source('src/Store.ts', '')];
  const graph = buildGraph(files);
  assert.deepEqual(graph.sequence.map(step => step.line), [5, 6, 7, 8, 9]);
  const guide = { sequence: [graph.sequence[0], { ...graph.sequence[0], line: 10, label: 'AI proposed cleanup relation' }] };
  const combined = buildGraph(files, guide);
  assert.deepEqual(combined.sequence.map(step => step.line), [5, 6, 7, 8, 9, 10]);
  assert.equal(combined.sequence.filter(step => step.line === 5).length, 1);
  assert.equal(combined.sequence.at(-1).evidence, 'inferred');
});

test('quoted and commented imports never become resolved dependency evidence', () => {
  const files = [source('src/Example.ts', `const example = "import { Store } from './Store';";
/*
import { Store } from './Store';
*/`), source('src/Store.ts', ''), source('docs/example.md', "import { Store } from '../src/Store';")];
  const graph = buildGraph(files);
  assert.deepEqual(graph.dependencies, []);
  assert.deepEqual(graph.sequence, []);
});
