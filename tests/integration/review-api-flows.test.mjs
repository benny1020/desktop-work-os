import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeApiFlows } from '../../src/lib/review-api-flows.mjs';
import { apiDemoFiles } from '../../src/lib/api-demo-review.js';
import { parseDiff } from '../../src/lib/review-model.mjs';
const file = (path, content, contextOnly = false) => ({ path, content, contextOnly, rows: [], diff: '' });
const root = body => file('Controller.ts', `import { Controller, Post } from '@nestjs/common';\nimport { Service } from './Service';\n@Controller('api') export class Controller { constructor(private service: Service) {}\n@Post('run') async run() { ${body} } }`);

test('same Controller and Service are repeated per API without mixing method ranges', async () => {
  const r = await analyzeApiFlows(apiDemoFiles);
  assert.deepEqual(r.flows.map(f => f.title), ['POST /payments/capture', 'POST /payments/refund']);
  const [capture, refund] = r.flows;
  assert.ok(capture.paths.includes('src/payments/PaymentService.ts'));
  assert.ok(refund.paths.includes('src/payments/PaymentService.ts'));
  assert.ok(!capture.ranges.some(r => r.name === 'refund' || r.name === 'saveRefund'));
  assert.ok(!refund.ranges.some(r => r.name === 'capture' || r.name === 'saveCapture'));
  assert.equal(capture.endings.filter(e => e.root && e.kind === 'return').length, 1);
  assert.ok(capture.boundaries.some(b => b.receiver === 'this.client'));
  assert.deepEqual(r.failures, []);
});
test('unchanged connector methods remain available with canonical source and comment coordinates', async () => {
  const { flows, contextFiles, consumedPaths } = await analyzeApiFlows(apiDemoFiles);
  for (const flow of flows) {
    const audit = flow.ranges.find(r => r.className === 'PaymentAuditService');
    assert.equal(audit.changed, false);
    assert.equal(audit.bodyLine, 6);
    assert.ok(contextFiles.find(f => f.path === audit.path).contextOnly);
  }
  assert.ok(!consumedPaths.includes('docs/payment-contract.md'));
});
test('changed downstream method discovers an unchanged API entry point', async () => {
  const controller = { ...root('return this.service.run();'), contextOnly: true };
  const r = await analyzeApiFlows([controller, file('Service.ts', 'export class Service { run() { return 2; } }')]);
  assert.equal(r.flows.length, 1);
  assert.deepEqual(r.flows[0].changedPaths, ['Service.ts']);
});
test('literal NestJS decorator aliases resolve but untrusted lookalike annotations do not', async () => {
  const source = "import {Controller as C, Get as G} from '@nestjs/common'; @C('orders') export class Orders { @G(':id') read(id: string) { return id; } }";
  assert.equal((await analyzeApiFlows([file('Orders.ts', source)])).flows[0].title, 'GET /orders/:id');
  assert.equal((await analyzeApiFlows([file('Orders.ts', source.replace('@nestjs/common', './fake'))])).flows.length, 0);
});
test('Java Spring APIs use imported types, separate shared methods, and ignore produces when choosing the route', async () => {
  const controller = file('p/PaymentController.java', `package p; import org.springframework.stereotype.Controller; import org.springframework.web.bind.annotation.*;
@Controller @RequestMapping("/payments") public class PaymentController { private PaymentService service;
@PostMapping(produces="application/json", path="/capture") public String capture() { return service.capture(); }
@PostMapping("/refund") public String refund() { return service.refund(); } }`);
  const service = file('p/PaymentService.java', 'package p; public class PaymentService { public String capture() { return "captured"; } public String refund() { return "refunded"; } }');
  const r = await analyzeApiFlows([controller, service]);
  assert.deepEqual(r.flows.map(f => f.title), ['POST /payments/capture', 'POST /payments/refund']);
  assert.deepEqual(r.flows[0].ranges.map(r => r.name), ['capture', 'capture']);
  assert.deepEqual(r.flows[1].ranges.map(r => r.name), ['refund', 'refund']);
  assert.deepEqual(r.failures, []);
});
test('a business flow larger than twelve files is not arbitrarily split', async () => {
  const list = [root('return this.service.run();'), file('Service.ts', "import { Step1 } from './Step1'; export class Service { constructor(private step: Step1) {} run() { return this.step.run(); } }")];
  for (let i = 1; i <= 18; i++) list.push(file(`Step${i}.ts`, i === 18 ? `export class Step${i} { run() { return 1; } }` : `import { Step${i + 1} } from './Step${i + 1}'; export class Step${i} { constructor(private step: Step${i + 1}) {} run() { return this.step.run(); } }`));
  const r = await analyzeApiFlows(list);
  assert.equal(r.flows.length, 1); assert.equal(r.flows[0].paths.length, 20); assert.equal(r.flows[0].coverage.truncated, false);
});
test('same-class helper calls are connected but lexical functions are never assumed to be this methods', async () => {
  const r = await analyzeApiFlows([root('const a = await this.service.run(); return a;'), file('Service.ts', 'export class Service { run() { validate(); return this.validate(); } validate() { return 1; } }')]);
  assert.equal(r.flows[0].graph.sequence.filter(e => e.from === e.to).length, 1);
  assert.ok(r.flows[0].boundaries.some(b => b.receiver === '<lexical>'));
});
test('deferred callbacks and recursion remain explicit boundaries, not invented execution paths', async () => {
  const r = await analyzeApiFlows([root('return this.service.run();'), file('Service.ts', 'export class Service { run() { later(() => { return this.helper(); }); return this.run(); } helper() { return 1; } }')]);
  const flow = r.flows[0];
  assert.ok(flow.boundaries.some(b => /Callback/.test(b.reason)));
  assert.ok(flow.boundaries.some(b => /Recursive/.test(b.reason)));
  assert.equal(flow.endings.filter(e => e.method === 'run' && !e.root).length, 1);
});
test('pure deletions retain conservative API impact while unrelated methods remain in fallback coverage', async () => {
  const s = file('Service.ts', 'export class Service { run() { return 1; } unrelated() { return 2; } }');
  s.rows = parseDiff('@@ -1,2 +1,1 @@\n-old();\n export class Service { run() { return 1; } unrelated() { return 2; } }');
  const r = await analyzeApiFlows([root('return this.service.run();'), s]);
  assert.equal(r.flows.length, 1); assert.ok(!r.consumedPaths.includes('Service.ts'));
});
test('parser failures, dynamic routes and omitted context are surfaced without creating fake endpoints', async () => {
  const r = await analyzeApiFlows([file('bad.ts', 'export class {'), file('dynamic.ts', "import { Controller, Post } from '@nestjs/common'; @Controller(PREFIX) class C { @Post('run') run() { return 1; } }")], { coverage: { omittedFiles: 7 } });
  assert.equal(r.flows.length, 0); assert.equal(r.failures.length, 1); assert.equal(r.coverage.omittedFiles, 7);
});
test('a deletion inside one method is not lost when a different method also adds lines', async () => {
  const content = 'export class Service {\n run() {\n  return 1;\n }\n unrelated() {\n  return 2;\n }\n}';
  const s = file('Service.ts', content);
  s.rows = parseDiff('@@ -1,9 +1,8 @@\n export class Service {\n  run() {\n-  unsafe();\n   return 1;\n  }\n  unrelated() {\n-  return 1;\n+  return 2;\n  }\n }');
  const r = await analyzeApiFlows([root('return this.service.run();'), s]);
  assert.equal(r.flows.length, 1);
  assert.equal(r.flows[0].ranges.find(r => r.className === 'Service').changed, true);
  assert.ok(!r.consumedPaths.includes('Service.ts'));
});
test('Java local variables shadowing injected fields stay unresolved instead of claiming a field call', async () => {
  const controller = file('p/C.java', 'package p; import org.springframework.web.bind.annotation.*; @RestController public class C { private S service; @GetMapping("run") public String run(S service) { return service.run(); } }');
  const service = file('p/S.java', 'package p; public class S { public String run() { return "ok"; } }');
  const r = await analyzeApiFlows([controller, service]);
  assert.equal(r.flows[0].ranges.length, 1);
  assert.ok(r.flows[0].boundaries.some(b => b.name === 'run'));
});
test('repeated calls on the same source line keep distinct call offsets and method identities', async () => {
  const r = await analyzeApiFlows([root('this.service.run(); return this.service.run();'), file('Service.ts', 'export class Service { run() { return 1; } }')]);
  const calls = r.flows[0].graph.sequence;
  assert.equal(calls.length, 2); assert.equal(calls[0].line, calls[1].line);
  assert.notEqual(calls[0].offset, calls[1].offset);
});
test('colocated injected types without an import stay an explicit unresolved boundary', async () => {
  const content = "import {Controller, Get} from '@nestjs/common'; @Controller('api') class C { constructor(private service: S) {} @Get('run') run() { return this.service.run(); } } export class S { run() { return 1; } }";
  // Colocated injected types are not an imported target. Keep that boundary unresolved.
  const r = await analyzeApiFlows([file('Module.ts', content)]);
  assert.equal(r.flows[0].ranges.length, 1);
  assert.ok(r.flows[0].boundaries.some(b => b.name === 'run'));
});
test('Java route arrays stay in fallback and RequestMapping verbs cannot be forged by a string literal', async () => {
  const array = file('C.java', 'import org.springframework.web.bind.annotation.*; @RestController class C { @GetMapping({"/capture", "/refund"}) String run() { return "ok"; } }');
  assert.equal((await analyzeApiFlows([array])).flows.length, 0);
  const literal = file('C.java', 'import org.springframework.web.bind.annotation.*; @RestController class C { @RequestMapping(value="/capture", produces="RequestMethod.DELETE", method=RequestMethod.POST) String run() { return "ok"; } }');
  assert.equal((await analyzeApiFlows([literal])).flows[0].title, 'POST /capture');
});
