import test from 'node:test';
import assert from 'node:assert/strict';
import { complexDemoSnapshot } from '../../src/lib/complex-demo-review.js';
import { buildGraph } from '../../src/lib/review-model.mjs';
import { annotateTransactions, transactionScopes, stepTransaction } from '../../src/lib/review-transactions.mjs';

const file = (content, path = 'src/Service.ts') => ({ path, content });
test('Three business scopes use exact head coordinates and resolved wrapper evidence', () => {
  const files = complexDemoSnapshot().files;
  const graph = annotateTransactions(buildGraph(files), files);
  assert.deepEqual(graph.transactions.scopes.map(scope => [scope.path, scope.startLine, scope.endLine]), [
    ['src/capture/PaymentCaptureService.ts', 27, 31],
    ['src/webhooks/PaymentWebhookService.ts', 16, 21],
    ['src/reconciliation/ReconciliationService.ts', 20, 23],
  ]);
  for (const scope of graph.transactions.scopes) {
    assert.equal(scope.evidence.path, 'src/shared/TransactionManager.ts');
    const within = graph.sequence.filter(step => step.path === scope.path && step.line > scope.startLine && step.line < scope.endLine);
    assert.ok(within.length >= 2);
    for (const step of within) assert.equal(stepTransaction(graph, step).state, 'inside');
  }
  for (const line of [26, 34, 35, 38]) assert.equal(stepTransaction(graph, { path: 'src/capture/PaymentCaptureService.ts', line }).state, 'outside');
  assert.equal(stepTransaction(graph, { path: 'src/reconciliation/ReconciliationService.ts', line: 28 }).state, 'outside');
});
test('Comments, strings, regex and unrelated run helpers cannot create scopes', () => {
  const content = `// db.transaction(async tx => { misleading(); });
const text = "db.transaction(async tx => { fake(); })";
const pattern = /db.transaction(async tx => {fake();})/;
runner.run(async tx => { task(); });
runner.transaction(async tx => { task(); });`;
  assert.deepEqual(transactionScopes([file(content)]).scopes, []);
});
test('Nested callbacks preserve outer and inner ranges despite quoted braces', () => {
  const content = `db.transaction(async outer => {
  const text = '}';
  await prisma.$transaction(async inner => {
    repository.save(inner);
  });
  repository.save(outer);
});`;
  const graph = annotateTransactions({ sequence: [] }, [file(content)]);
  assert.deepEqual(graph.transactions.scopes.map(scope => [scope.startLine, scope.endLine]), [[1, 7], [3, 5]]);
  assert.equal(stepTransaction(graph, { path: 'src/Service.ts', line: 4 }).inside.length, 2);
  assert.equal(stepTransaction(graph, { path: 'src/Service.ts', line: 6 }).inside.length, 1);
});
test('Diff gaps, deleted source, oversized files and unclosed callbacks stay unavailable', () => {
  const files = [{ path: 'partial.ts', diff: '@@ -1 +1 @@\n+db.transaction(async tx => {\n@@ -50 +50 @@\n+});' },
    { ...file('db.transaction(async tx => {});', 'deleted.ts'), deleted_file: true },
    file(' '.repeat(200001), 'large.ts')];
  const graph = annotateTransactions({}, files);
  assert.deepEqual(graph.transactions.scopes, []);
  for (const item of files) assert.equal(stepTransaction(graph, { path: item.path, line: 1 }).state, 'unavailable');
  assert.deepEqual(transactionScopes([file('db.transaction(async tx => {')]).scopes, []);
});
test('An imported wrapper must forward the callback directly, not merely contain a transaction', () => {
  const caller = file(`import { TransactionManager } from './TransactionManager';
class Service {
 constructor(private readonly runner: TransactionManager) {}
 run() { return this.runner.run(async tx => { save(tx); }); }
}`);
  const wrapper = file(`export class TransactionManager {
 run<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
   return this.db.transaction(operation);
 }
}`, 'src/TransactionManager.ts');
  assert.equal(transactionScopes([caller, wrapper]).scopes.length, 1);
  for (const content of [wrapper.content.replace('transaction(operation)', 'transaction(other)'),
    wrapper.content.replace('transaction(operation);', 'transaction(operation); notify();'),
    wrapper.content.replace('return this.db', 'notify(); return this.db')])
    assert.equal(transactionScopes([caller, { ...wrapper, content }]).scopes.length, 0);
  assert.equal(transactionScopes([{ ...caller, content: caller.content.replace("'./TransactionManager'", "'./missing'") }, wrapper]).scopes.length, 0);
});
test('Spring method annotations are declarations; non-transactional propagation is excluded', () => {
  const content = `import org.springframework.transaction.annotation.Transactional;
class PaymentService {
 @Transactional(readOnly = true)
 public Payment save(Request request) {
   return repository.save(request);
 }
 public void publish() { outbox.publish(); }
}`;
  const graph = annotateTransactions({}, [file(content, 'PaymentService.java')]);
  assert.deepEqual(graph.transactions.scopes.map(scope => [scope.startLine, scope.endLine, scope.kind]), [[3, 6, 'annotation']]);
  assert.equal(stepTransaction(graph, { path: 'PaymentService.java', line: 7 }).state, 'outside');
  for (const propagation of ['NOT_SUPPORTED', 'NEVER', 'SUPPORTS']) {
    assert.equal(transactionScopes([file(content.replace('readOnly = true', `propagation = Propagation.${propagation}`), 'PaymentService.java')]).scopes.length, 0);
  }
  assert.equal(transactionScopes([file(content.replace('org.springframework.transaction.annotation.Transactional', 'custom.Transactional'), 'PaymentService.java')]).scopes.length, 0);
});
test('AI sequence evidence never supplies fabricated transaction boundaries', () => {
  const graph = annotateTransactions({ sequence: [{ path: 'src/Service.ts', line: 1, transaction: 'fake' }] }, [file('const nothing = true;')]);
  assert.equal(stepTransaction(graph, graph.sequence[0]).state, 'undetected');
});
test('Multiple statements on a boundary line remain explicit instead of claiming atomic execution', () => {
  const graph = annotateTransactions({}, [file('db.transaction(async tx => { save(tx); }); publish();')]);
  assert.equal(stepTransaction(graph, { path: 'src/Service.ts', line: 1 }).state, 'boundary');
  const nested = annotateTransactions({}, [file('db.transaction(async tx => { prisma.$transaction(async inner => { save(inner); }); });')]);
  assert.equal(new Set(nested.transactions.scopes.map(scope => scope.id)).size, 2);
  assert.equal(stepTransaction(nested, { path: 'src/Service.ts', line: 1 }).state, 'boundary');
});
test('A transactional helper in another class cannot make the imported manager transactional', () => {
  const caller = file(`import { TransactionManager } from './TransactionManager';
class Service {
 constructor(private readonly runner: TransactionManager) {}
 run() { return this.runner.run(async tx => { save(tx); }); }
}`);
  const wrapper = file(`export class TransactionManager { run() { return true; } }
class Other {
 run<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
   return this.db.transaction(operation);
 }
}`, 'src/TransactionManager.ts');
  assert.equal(transactionScopes([caller, wrapper]).scopes.length, 0);
});
