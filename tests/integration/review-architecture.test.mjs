import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyReviewFile, annotateReviewGraph, architectureLayout, reviewFlowMetadata } from '../../src/lib/review-architecture.mjs';
import { buildGraph, parseDiff } from '../../src/lib/review-model.mjs';
const source = (path, content) => ({ path, content, rows: [], diff: '' });

test('Spring annotations establish roles and endpoint with exact source location over misleading filename', () => {
  const file = source('src/main/java/com/acme/PaymentThing.java', '@RestController\n@RequestMapping("/payments")\npublic class PaymentThing {}');
  const result = classifyReviewFile(file);
  assert.equal(result.role, 'controller');
  assert.equal(result.confidence, 'code');
  assert.equal(result.evidence[0].line, 1);
  assert.deepEqual(result.endpoint, { path: '/payments', method: null, line: 2 });
  assert.equal(classifyReviewFile(source('Unclear.java', '@Service\npublic class Unclear {}')).role, 'service');
  assert.equal(classifyReviewFile(source('Unclear.java', 'public interface Unclear extends JpaRepository<Payment, Long> {}')).role, 'repository');
  assert.equal(classifyReviewFile(source('Unclear.java', '@Entity\npublic class Unclear {}')).role, 'model');
});

test('TS Nest controller decorator, directory conventions and strict suffixes retain honest confidence', () => {
  const controller = classifyReviewFile(source('apps/api/payment.controller.ts', '@Controller("payments")\nexport class PaymentController {}'));
  assert.equal(controller.role, 'controller');
  assert.equal(controller.endpoint.path, 'payments');
  assert.equal(classifyReviewFile({ path: 'src/features/payments/PaymentService.ts' }).confidence, 'name');
  assert.equal(classifyReviewFile({ path: 'src/repositories/payments.ts' }).role, 'repository');
  assert.equal(classifyReviewFile({ path: 'src/components/PaymentSummary.tsx' }).role, 'ui');
  assert.equal(classifyReviewFile({ path: 'PaymentServiceFactory.ts' }).role, 'other');
  assert.equal(classifyReviewFile({ path: 'ControllerGuide.ts' }).role, 'other');
  assert.equal(classifyReviewFile({ path: 'src/modules/payment/payment.controller.ts', deferred: true }).role, 'controller');
  assert.equal(classifyReviewFile({ path: 'src/modules/payment/payment.service.ts', deferred: true }).role, 'service');
  assert.equal(classifyReviewFile({ path: 'src/hooks/usePayment.ts' }).confidence, 'unknown');
});

test('comments, removed source and annotation-like strings cannot establish current code role', () => {
  const file = source('x.ts', '// @Controller("wrong")\n/*\n@Service\n*/\nconst sample = "@Repository";');
  assert.equal(classifyReviewFile(file).role, 'other');
  const diff = '@@ -1 +1 @@\n-@Service\n+export const id = 1;';
  assert.equal(classifyReviewFile({ path: 'x.ts', rows: parseDiff(diff) }).role, 'other');
  const ambiguous = classifyReviewFile(source('x.java', '@Service\n@Repository\npublic class X {}'));
  assert.equal(ambiguous.role, 'other');
  assert.equal(ambiguous.confidence, 'ambiguous');
  assert.equal(ambiguous.evidence.length, 2);
});

test('tests/docs/config and deferred unknown files stay explicit rather than resembling business layers', () => {
  assert.equal(classifyReviewFile(source('tests/PaymentControllerTest.java', '@RestController')).role, 'tests');
  assert.equal(classifyReviewFile({ path: 'docs/PaymentService.md' }).role, 'docs');
  assert.equal(classifyReviewFile({ path: '.github/workflows/test.yml' }).role, 'config');
  assert.equal(classifyReviewFile({ path: 'src/config/payment.ts' }).role, 'config');
  assert.equal(classifyReviewFile({ path: 'src/RetryWorker.ts' }).role, 'integration');
  assert.equal(classifyReviewFile({ path: 'src/RetryQueue.ts' }).role, 'integration');
  assert.equal(classifyReviewFile({ path: 'src/PaymentClient.ts' }).role, 'integration');
  assert.equal(classifyReviewFile({ path: 'src/PaymentMapper.java' }).role, 'model');
  assert.equal(classifyReviewFile(source('src/PaymentMapper.java', 'import org.apache.ibatis.annotations.Mapper;\n@Mapper\npublic interface PaymentMapper {}')).role, 'repository');
  assert.equal(classifyReviewFile(source('src/StatusMapper.java', 'import org.mapstruct.Mapper;\n@Mapper\npublic interface StatusMapper {}')).role, 'model');
  const deferred = classifyReviewFile({ path: 'src/unknown.ts', deferred: true });
  assert.equal(deferred.role, 'other');
  assert.match(deferred.evidence[0].detail, /not loaded/);
});

test('role bands keep controller/service/repository readable without inventing edges or clipping single-column nodes', () => {
  const files = ['src/PaymentRepository.ts', 'src/PaymentController.ts', 'src/PaymentService.ts', 'src/Unknown.ts'].map(path => source(path, ''));
  const original = buildGraph(files);
  const graph = annotateReviewGraph(original, files);
  const layout = architectureLayout(graph);
  assert.deepEqual(layout.layerRoles, ['controller', 'service', 'repository', 'other']);
  assert.equal(layout.width, 284);
  assert.equal(layout.nodeH, 64);
  assert.equal(layout.height, 460);
  assert.deepEqual(graph.dependencies, []);
  assert.ok(original.nodes.every(node => !node.role));
  for (const point of layout.positions.values()) {
    assert.ok(point.x >= 0 && point.x + layout.nodeW <= layout.width);
    assert.ok(point.y >= 0 && point.y + layout.nodeH <= layout.height);
  }
  assert.equal(architectureLayout({ nodes: [{ id: 'x', role: 'other' }], dependencies: [] }), null);
});

test('cycles spanning architectural roles remain correctly marked with stable source ordering', () => {
  const files = ['src/PaymentService.ts', 'src/RetryQueue.ts', 'src/ExtraService.ts'].map(path => source(path, ''));
  const original = buildGraph(files);
  original.dependencies = [{ from: files[0].path, to: files[1].path }, { from: files[1].path, to: files[0].path }];
  const graph = annotateReviewGraph(original, files);
  const layout = architectureLayout(graph);
  assert.equal(layout.positions.get(files[0].path).cyclic, true);
  assert.equal(layout.positions.get(files[1].path).cyclic, true);
  assert.equal(layout.positions.get(files[2].path).cyclic, false);
  const reversed = architectureLayout({ ...graph, nodes: [...graph.nodes].reverse() });
  assert.deepEqual([...reversed.positions], [...layout.positions]);
});

test('human flow context identifies entrypoint and examples while distinguishing verified imports from conventions', () => {
  const files = [source('src/PaymentController.ts', ''), source('src/PaymentService.ts', ''), source('src/PaymentRepository.ts', '')];
  const paths = files.map(file => file.path);
  const metadata = reviewFlowMetadata(paths, files, {}, 'payments');
  assert.equal(metadata.title, 'Payment request handling');
  assert.equal(metadata.entrypoint.path, paths[0]);
  assert.deepEqual(metadata.rolePath, ['Controller', 'Service', 'Repository']);
  assert.equal(metadata.subtitle, 'PaymentController.ts · PaymentService.ts · PaymentRepository.ts');
  assert.equal(metadata.confidence, 'convention');
  assert.match(metadata.evidence, /execution order is unverified/);
  const verified = reviewFlowMetadata(paths, files, { dependencies: [{ from: paths[0], to: paths[1], evidence: 'code' }] }, 'payments');
  assert.equal(verified.confidence, 'imports');
  assert.match(verified.evidence, /1 verified import/);
  const unknown = reviewFlowMetadata(['src/data.ts'], [source('src/data.ts', '')], {}, 'Changed files');
  assert.equal(unknown.title, 'Changed files');
  assert.equal(unknown.confidence, 'directory');
  assert.match(unknown.evidence, /no execution flow/);
});
