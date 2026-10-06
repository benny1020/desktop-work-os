import { parseDiff, buildGraph } from './review-model.mjs';

// Review fixture only: these source strings are displayed, never executed.
// Three business areas intentionally share infrastructure and contain review questions.
const sources = {};
const before = {};
const nameDependencies = source => {
  const dependencies = [...source.matchAll(/private readonly (\w+): (\w+)/g)];
  for (const [, name, type] of dependencies) {
    const property = type[0].toLowerCase() + type.slice(1);
    source = source.replaceAll(`private readonly ${name}: ${type}`, `private readonly ${property}: ${type}`)
      .replaceAll(`this.${name}.`, `this.${property}.`);
  }
  return source;
};
const add = (path, source, previous = '') => {
  sources[path] = nameDependencies(source.trim());
  before[path] = nameDependencies(previous.trim());
};

add('src/capture/PaymentCaptureController.ts', `
import { Controller, Post, Body } from '@nestjs/common';
import { PaymentCaptureService } from './PaymentCaptureService';
import { CaptureRequest } from './CaptureRequest';

@Controller('/payments/capture')
export class PaymentCaptureController {
  constructor(private readonly service: PaymentCaptureService) {}

  @Post()
  async capture(@Body() request: CaptureRequest) {
    return this.service.capture(request);
  }
}`);
add('src/capture/PaymentCaptureService.ts', `
import { CaptureRepository } from './CaptureRepository';
import { RetryQueue } from './RetryQueue';
import { CaptureGateway } from './CaptureGateway';
import { CaptureRequest } from './CaptureRequest';
import { TransactionManager } from '../shared/TransactionManager';
import { IdempotencyStore } from '../shared/IdempotencyStore';
import { OutboxPublisher } from '../shared/OutboxPublisher';

export class PaymentCaptureService {
  constructor(
    private readonly repository: CaptureRepository,
    private readonly queue: RetryQueue,
    private readonly gateway: CaptureGateway,
    private readonly transactions: TransactionManager,
    private readonly idempotency: IdempotencyStore,
    private readonly outbox: OutboxPublisher,
  ) {}

  async capture(request: CaptureRequest) {
    const existing = await this.repository.findByKey(request.idempotencyKey);
    if (existing) return existing;
    const lease = await this.idempotency.acquire(request.idempotencyKey);
    if (!lease) throw new Error('Capture already running');

    try {
      const result = await this.gateway.capture(request);
      return await this.transactions.run(async tx => {
        const capture = await this.repository.save(tx, request, result);
        await this.outbox.publish(tx, 'payment.captured', capture);
        return capture;
      });
    } catch (error) {
      if (!this.gateway.isTransient(error)) throw error;
      const pending = await this.repository.savePending(request);
      await this.queue.enqueue({ request, attempt: 1 });
      return pending;
    } finally {
      await this.idempotency.release(request.idempotencyKey, lease);
    }
  }
}`, `
import { CaptureRepository } from './CaptureRepository';
import { CaptureGateway } from './CaptureGateway';
import { CaptureRequest } from './CaptureRequest';

export class PaymentCaptureService {
  constructor(
    private readonly repository: CaptureRepository,
    private readonly gateway: CaptureGateway,
  ) {}

  async capture(request: CaptureRequest) {
    const result = await this.gateway.capture(request);
    return this.repository.saveDirect(request, result);
  }
}`);
add('src/capture/CaptureRepository.ts', `
import type { CaptureRequest } from './CaptureRequest';

export class CaptureRepository {
  constructor(private readonly db: Database) {}
  findByKey(key: string) {
    return this.db.capture.findUnique({ where: { idempotencyKey: key } });
  }
  save(tx: Transaction, request: CaptureRequest, result: GatewayResult) {
    return tx.capture.upsert({
      where: { idempotencyKey: request.idempotencyKey },
      create: { ...request, gatewayId: result.id, status: 'captured' },
      update: { gatewayId: result.id, status: 'captured' },
    });
  }
  savePending(request: CaptureRequest) {
    return this.db.capture.create({ data: { ...request, status: 'pending' } });
  }
  findPendingBefore(cutoff: Date) {
    return this.db.capture.findMany({ where: { status: 'pending', createdAt: { lt: cutoff } } });
  }
}`);
add('src/capture/PaymentRetryWorker.ts', `
import { PaymentCaptureService } from './PaymentCaptureService';
import { RetryQueue } from './RetryQueue';
import { RetryPolicy } from '../shared/RetryPolicy';

export class PaymentRetryWorker {
  constructor(
    private readonly service: PaymentCaptureService,
    private readonly queue: RetryQueue,
    private readonly policy: RetryPolicy,
  ) {}
  async process(job: CaptureJob) {
    if (this.policy.exhausted(job.attempt)) {
      return this.queue.moveToDeadLetter(job, 'Retry budget exhausted');
    }
    const result = await this.service.capture(job.request);
    if (result.status === 'pending') {
      await this.queue.enqueue({ ...job, attempt: job.attempt + 1 });
    }
    return result;
  }
}`);
add('src/capture/RetryQueue.ts', `
import { RetryPolicy } from '../shared/RetryPolicy';

export class RetryQueue {
  constructor(private readonly queue: JobQueue, private readonly policy: RetryPolicy) {}
  enqueue(job: CaptureJob) {
    return this.queue.add('payment-capture', job, {
      jobId: job.request.idempotencyKey + ':' + job.attempt,
      delay: this.policy.delay(job.attempt),
      removeOnComplete: true,
    });
  }
  moveToDeadLetter(job: CaptureJob, reason: string) {
    return this.queue.add('payment-dead-letter', { ...job, reason });
  }
}`);
add('src/capture/CaptureGateway.ts', `
import type { CaptureRequest } from './CaptureRequest';

export class CaptureGateway {
  constructor(private readonly client: GatewayClient) {}
  capture(request: CaptureRequest) {
    return this.client.post('/captures', {
      amount: request.amount, currency: request.currency,
      orderId: request.orderId,
    }, { headers: { 'Idempotency-Key': request.idempotencyKey }, timeout: 5000 });
  }
  isTransient(error: GatewayError) {
    return error.code === 'ETIMEDOUT' || error.status >= 500;
  }
}`);
add('src/capture/CaptureRequest.ts', `
export interface CaptureRequest {
  orderId: string;
  amount: number;
  currency: 'KRW' | 'USD';
  idempotencyKey: string;
}
export interface CaptureJob {
  request: CaptureRequest;
  attempt: number;
}`);
add('src/capture/PaymentCaptureService.test.ts', `
import { PaymentCaptureService } from './PaymentCaptureService';

describe('durable capture', () => {
  it('returns the completed capture for a repeated key', async () => {
    const { service, repository, gateway } = captureFixture(PaymentCaptureService);
    repository.findByKey.mockResolvedValue({ status: 'captured', id: 'cap_42' });
    expect(await service.capture(request)).toMatchObject({ status: 'captured' });
    expect(gateway.capture).not.toHaveBeenCalled();
  });
  it('persists pending state and schedules a transient failure', async () => {
    const { service, gateway, queue } = captureFixture(PaymentCaptureService);
    gateway.capture.mockRejectedValue({ code: 'ETIMEDOUT' });
    expect(await service.capture(request)).toMatchObject({ status: 'pending' });
    expect(queue.enqueue).toHaveBeenCalledWith({ request, attempt: 1 });
  });
});`);
add('src/capture/PaymentRetryWorker.test.ts', `
import { PaymentRetryWorker } from './PaymentRetryWorker';

describe('retry worker', () => {
  it('dead-letters an exhausted capture', async () => {
    const { worker, queue, service } = retryFixture(PaymentRetryWorker);
    await worker.process({ request, attempt: 6 });
    expect(queue.moveToDeadLetter).toHaveBeenCalled();
    expect(service.capture).not.toHaveBeenCalled();
  });
  it('increments attempts when the service returns pending', async () => {
    const { worker, queue, service } = retryFixture(PaymentRetryWorker);
    service.capture.mockResolvedValue({ status: 'pending' });
    await worker.process({ request, attempt: 2 });
    expect(queue.enqueue).toHaveBeenCalledWith({ request, attempt: 3 });
  });
});`);

add('src/webhooks/PaymentWebhookController.ts', `
import { Controller, Post, Req, Headers } from '@nestjs/common';
import { PaymentWebhookService } from './PaymentWebhookService';
import { SignatureVerifier } from './SignatureVerifier';

@Controller('/webhooks/payments')
export class PaymentWebhookController {
  constructor(private readonly service: PaymentWebhookService,
    private readonly signatures: SignatureVerifier) {}
  @Post()
  async receive(@Req() request: RawRequest, @Headers('x-payment-signature') signature: string) {
    this.signatures.verify(request.rawBody, signature);
    await this.service.accept(JSON.parse(request.rawBody.toString()));
    return { accepted: true };
  }
}`);
add('src/webhooks/PaymentWebhookService.ts', `
import { WebhookRepository } from './WebhookRepository';
import { PaymentEvent } from './PaymentEvent';
import { TransactionManager } from '../shared/TransactionManager';
import { IdempotencyStore } from '../shared/IdempotencyStore';
import { OutboxPublisher } from '../shared/OutboxPublisher';

export class PaymentWebhookService {
  constructor(private readonly repository: WebhookRepository,
    private readonly transactions: TransactionManager,
    private readonly idempotency: IdempotencyStore,
    private readonly outbox: OutboxPublisher) {}
  async accept(event: PaymentEvent) {
    const lease = await this.idempotency.acquire('event:' + event.id);
    if (!lease) return { duplicate: true };
    try {
      return await this.transactions.run(async tx => {
        if (await this.repository.wasProcessed(tx, event.id)) return;
        await this.repository.applyPaymentStatus(tx, event);
        await this.repository.recordEvent(tx, event);
        await this.outbox.publish(tx, 'payment.status-updated', event);
      });
    } finally {
      await this.idempotency.release('event:' + event.id, lease);
    }
  }
}`);
add('src/webhooks/WebhookRepository.ts', `
import type { PaymentEvent } from './PaymentEvent';

export class WebhookRepository {
  wasProcessed(tx: Transaction, eventId: string) {
    return tx.paymentEvent.findUnique({ where: { id: eventId } });
  }
  applyPaymentStatus(tx: Transaction, event: PaymentEvent) {
    return tx.capture.update({
      where: { gatewayId: event.paymentId },
      data: { status: event.status, gatewaySequence: event.sequence },
    });
  }
  recordEvent(tx: Transaction, event: PaymentEvent) {
    return tx.paymentEvent.create({ data: event });
  }
}`);
add('src/webhooks/SignatureVerifier.ts', `
import { createHmac, timingSafeEqual } from 'node:crypto';

export class SignatureVerifier {
  constructor(private readonly secret: string) {}
  verify(rawBody: Buffer, signature: string) {
    const expected = createHmac('sha256', this.secret).update(rawBody).digest();
    const received = Buffer.from(signature || '', 'hex');
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) {
      throw new Error('Invalid payment webhook signature');
    }
  }
}`);
add('src/webhooks/PaymentEvent.ts', `
export interface PaymentEvent {
  id: string;
  paymentId: string;
  sequence: number;
  status: 'captured' | 'refunded' | 'failed';
  occurredAt: string;
}`);
add('src/webhooks/PaymentWebhookService.test.ts', `
import { PaymentWebhookService } from './PaymentWebhookService';

describe('payment webhooks', () => {
  it('does not publish the same gateway event twice', async () => {
    const { service, repository, outbox } = webhookFixture(PaymentWebhookService);
    repository.wasProcessed.mockResolvedValue({ id: event.id });
    await service.accept(event);
    expect(outbox.publish).not.toHaveBeenCalled();
  });
  it('writes the event and status in one transaction', async () => {
    const { service, repository } = webhookFixture(PaymentWebhookService);
    await service.accept(event);
    expect(repository.recordEvent).toHaveBeenCalledWith(transaction, event);
  });
});`);
add('src/webhooks/WebhookContract.test.ts', `
import { PaymentWebhookController } from './PaymentWebhookController';
import { SignatureVerifier } from './SignatureVerifier';

describe('raw webhook body contract', () => {
  it('rejects a modified payload with its original signature', () => {
    const verifier = new SignatureVerifier('fixture-only-secret');
    expect(() => verifier.verify(Buffer.from('{"amount":999}'), signature)).toThrow();
  });
  it('responds successfully after durable event storage', async () => {
    const controller = webhookControllerFixture(PaymentWebhookController);
    expect(await controller.receive(rawRequest, signature)).toEqual({ accepted: true });
  });
});`);

add('src/reconciliation/ReconciliationWorker.ts', `
import { ReconciliationService } from './ReconciliationService';
import { RetryPolicy } from '../shared/RetryPolicy';

export class ReconciliationWorker {
  constructor(private readonly service: ReconciliationService,
    private readonly policy: RetryPolicy) {}
  async tick() {
    const result = await this.service.reconcileBatch(100);
    return { ...result, nextDelay: this.policy.delay(result.failures ? 2 : 0) };
  }
}`);
add('src/reconciliation/ReconciliationService.ts', `
import { ReconciliationRepository } from './ReconciliationRepository';
import { SettlementGateway } from './SettlementGateway';
import { ReconciliationResult } from './ReconciliationResult';
import { CaptureRepository } from '../capture/CaptureRepository';
import { TransactionManager } from '../shared/TransactionManager';
import { OutboxPublisher } from '../shared/OutboxPublisher';

export class ReconciliationService {
  constructor(private readonly repository: ReconciliationRepository,
    private readonly gateway: SettlementGateway,
    private readonly captures: CaptureRepository,
    private readonly transactions: TransactionManager,
    private readonly outbox: OutboxPublisher) {}
  async reconcileBatch(limit: number): Promise<ReconciliationResult> {
    const cursor = await this.repository.readCursor();
    const entries = await this.gateway.listSettlements(cursor, limit);
    const failures: string[] = [];
    for (const entry of entries) {
      try {
        await this.transactions.run(async tx => {
          await this.repository.applySettlement(tx, entry);
          await this.outbox.publish(tx, 'payment.reconciled', entry);
        });
      } catch (error) {
        failures.push(entry.id);
      }
    }
    if (entries.length) await this.repository.advanceCursor(entries.at(-1).id);
    const pending = await this.captures.findPendingBefore(new Date(Date.now() - 300000));
    return { processed: entries.length - failures.length, failures: failures.length,
      failedIds: failures, staleCaptures: pending.length };
  }
}`);
add('src/reconciliation/ReconciliationRepository.ts', `
export class ReconciliationRepository {
  constructor(private readonly db: Database) {}
  async readCursor() {
    return (await this.db.cursor.findUnique({ where: { name: 'payments' } }))?.value || '';
  }
  advanceCursor(value: string) {
    return this.db.cursor.upsert({ where: { name: 'payments' },
      create: { name: 'payments', value }, update: { value } });
  }
  applySettlement(tx: Transaction, entry: Settlement) {
    return tx.settlement.upsert({ where: { id: entry.id }, create: entry, update: entry });
  }
}`);
add('src/reconciliation/SettlementGateway.ts', `
export class SettlementGateway {
  constructor(private readonly client: GatewayClient) {}
  listSettlements(cursor: string, limit: number) {
    return this.client.get('/settlements', { params: { after: cursor, limit }, timeout: 10000 });
  }
}`);
add('src/reconciliation/ReconciliationResult.ts', `
export interface ReconciliationResult {
  processed: number;
  failures: number;
  failedIds: string[];
  staleCaptures: number;
}`);
add('src/reconciliation/ReconciliationService.test.ts', `
import { ReconciliationService } from './ReconciliationService';

describe('settlement recovery', () => {
  it('continues processing after one settlement fails', async () => {
    const { service, gateway, repository } = reconciliationFixture(ReconciliationService);
    gateway.listSettlements.mockResolvedValue([settlementA, settlementB]);
    repository.applySettlement.mockRejectedValueOnce(new Error('DB timeout'));
    expect(await service.reconcileBatch(100)).toMatchObject({ processed: 1, failures: 1 });
  });
  it('leaves the cursor unchanged for an empty page', async () => {
    const { service, gateway, repository } = reconciliationFixture(ReconciliationService);
    gateway.listSettlements.mockResolvedValue([]);
    await service.reconcileBatch(100);
    expect(repository.advanceCursor).not.toHaveBeenCalled();
  });
});`);

add('src/shared/TransactionManager.ts', `
export class TransactionManager {
  constructor(private readonly db: Database) {}
  run<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(operation, { isolationLevel: 'ReadCommitted', timeout: 10000 });
  }
}`);
add('src/shared/IdempotencyStore.ts', `
import { randomUUID } from 'node:crypto';

export class IdempotencyStore {
  constructor(private readonly redis: RedisClient) {}
  async acquire(key: string) {
    const owner = randomUUID();
    const acquired = await this.redis.set('payment:' + key, owner, 'PX', 30000, 'NX');
    return acquired ? owner : null;
  }
  release(key: string, owner: string) {
    return this.redis.eval(
      "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
      1, 'payment:' + key, owner,
    );
  }
}`);
add('src/shared/OutboxPublisher.ts', `
export class OutboxPublisher {
  publish(tx: Transaction, topic: string, payload: { id: string }) {
    return tx.outbox.create({ data: {
      id: crypto.randomUUID(), topic, aggregateId: payload.id,
      payload: JSON.stringify(payload), publishedAt: null,
    } });
  }
}`, `
export class OutboxPublisher {
  publish(client: BrokerClient, topic: string, payload: { id: string }) {
    return client.send(topic, JSON.stringify(payload));
  }
}`);
add('src/shared/RetryPolicy.ts', `
export class RetryPolicy {
  readonly maxAttempts = 5;
  exhausted(attempt: number) { return attempt > this.maxAttempts; }
  delay(attempt: number) {
    const base = Math.min(1000 * 2 ** attempt, 60000);
    return Math.round(base * (0.8 + Math.random() * 0.4));
  }
}`);
add('config/payment-recovery.yaml', `
paymentRecovery:
  enabled: true
  retry:
    maxAttempts: 5
    concurrency: 8
    deadLetterRetentionDays: 14
  reconciliation:
    intervalSeconds: 60
    batchSize: 100
  webhook:
    rawBody: true
    signatureSecretEnv: PAYMENT_WEBHOOK_SECRET
  outbox:
    pollIntervalMs: 500
    batchSize: 50`);
add('db/migrations/20261007_payment_recovery.sql', `
ALTER TABLE payment_capture ADD COLUMN gateway_sequence BIGINT NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX capture_idempotency_key ON payment_capture(idempotency_key);
CREATE TABLE payment_event (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  sequence BIGINT NOT NULL,
  status TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE payment_outbox (
  id UUID PRIMARY KEY,
  topic TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ
);
CREATE INDEX unpublished_payment_outbox ON payment_outbox(id) WHERE published_at IS NULL;`);
add('docs/payment-recovery.md', `
# Durable payment recovery

## Capture and retry
POST /payments/capture accepts an idempotency key. Transient gateway failures
persist a pending capture and enqueue a bounded retry with jitter.

## Webhook processing
POST /webhooks/payments verifies the raw body signature. Event IDs are deduplicated
in the same transaction as the status update and outbox record.

## Settlement reconciliation
The worker reads 100 settlements per batch and stores a durable cursor.
Review partial failure recovery and delayed webhook ordering before rollout.

## Rollout
Apply the additive migration first. Enable recovery for internal merchants,
watch pending capture age and dead-letter depth, then increase traffic gradually.`);
add('src/legacy/PaymentPollingWorker.ts', '', `
export class PaymentPollingWorker {
  constructor(private readonly gateway: GatewayClient) {}
  async poll(paymentId: string) {
    const payment = await this.gateway.get('/payments/' + paymentId);
    return payment.status;
  }
}`);

function changedFile(path) {
  const oldLines = before[path] ? before[path].split('\n') : [];
  const newLines = sources[path] ? sources[path].split('\n') : [];
  let prefix = 0, suffix = 0;
  while (prefix < Math.min(oldLines.length, newLines.length) && oldLines[prefix] === newLines[prefix]) prefix++;
  while (suffix < Math.min(oldLines.length, newLines.length) - prefix && oldLines.at(-suffix - 1) === newLines.at(-suffix - 1)) suffix++;
  const diff = `@@ -${oldLines.length ? 1 : 0},${oldLines.length} +${newLines.length ? 1 : 0},${newLines.length} @@\n` + [
    ...newLines.slice(0, prefix).map(line => ' ' + line),
    ...oldLines.slice(prefix, oldLines.length - suffix).map(line => '-' + line),
    ...newLines.slice(prefix, newLines.length - suffix).map(line => '+' + line),
    ...newLines.slice(newLines.length - suffix).map(line => ' ' + line),
  ].join('\n');
  return { path, old_path: path, new_path: path, content: sources[path], diff,
    new_file: !oldLines.length, deleted_file: !newLines.length, rows: parseDiff(diff) };
}
const files = Object.keys(sources).map(changedFile);
const fileOrder = new Map(files.map((file, index) => [file.path, index]));
const sequence = buildGraph(files).sequence
  .filter(step => /\bthis\.\w+\.\w+\(/.test(sources[step.path].split('\n')[step.line - 1] || ''))
  .sort((a, b) => fileOrder.get(a.path) - fileOrder.get(b.path) || a.line - b.line);
const lineOf = (path, text) => {
  const line = sources[path].split('\n').findIndex(line => line.includes(text)) + 1;
  if (!line) throw new Error(`Missing fixture anchor: ${path}: ${text}`);
  return line;
};
const capture = 'src/capture/PaymentCaptureService.ts';
const webhook = 'src/webhooks/WebhookRepository.ts';
const reconcile = 'src/reconciliation/ReconciliationService.ts';
const anchors = { capture: lineOf(capture, 'if (existing)'), webhook: lineOf(webhook, 'where: { gatewayId'),
  reconcile: lineOf(reconcile, 'advanceCursor') };

export const complexDemoMR = {
  id: '428', title: 'Introduce durable payment recovery', repo: 'commerce-api',
  author: 'Mina Choi', status: 'In review', ci: 'Passed', comments: 2,
  updated: '24m ago', issue: 'PAY-382', files: files.length,
  added: files.reduce((sum, file) => sum + file.rows.filter(row => row.kind === 'added').length, 0),
  removed: files.reduce((sum, file) => sum + file.rows.filter(row => row.kind === 'removed').length, 0),
};

export function complexDemoSnapshot(mr = complexDemoMR) {
  return {
    mr: { id: mr.id, iid: mr.id, project_id: mr.repo, title: mr.title, status: mr.status,
      source_branch: 'feat/durable-payment-recovery', target_branch: 'main',
      diff_refs: { base_sha: 'b20cd41'.padEnd(40, '0'),
        start_sha: 'b20cd41'.padEnd(40, '0'),
        head_sha: 'c428a91'.padEnd(40, '0') } },
    files,
    discussions: [
      { id: 'demo-capture-retry', notes: [{ id: 42801, author: { name: 'Daniel Lee' },
        body: 'Worker도 capture()를 호출하네요. pending 레코드가 존재하면 gateway까지 다시 도달할 수 있나요?',
        position: { new_path: capture, new_line: anchors.capture } }] },
      { id: 'demo-webhook-order', notes: [{ id: 42802, author: { name: 'Alex Kim' },
        body: 'refunded 다음에 지연된 captured 이벤트가 도착할 때 sequence 비교가 필요해 보입니다.',
        position: { new_path: webhook, new_line: anchors.webhook } }] },
    ],
    demoGuide: {
      summary: '결제 승인·웹훅 수신·정산 복구를 함께 변경하는 PR입니다. 선택한 흐름의 진입점 → 핵심 로직 → 저장 경계를 읽고, 공통 멱등성·트랜잭션과 실패 경로를 비교하세요. 아래는 코드에 연결된 샘플 리뷰 질문입니다.',
      dependencies: [], sequence,
      readingOrder: [
        ['src/capture/PaymentCaptureController.ts', 'async capture', '요청 진입점과 멱등성 키 전달을 확인합니다.'],
        [capture, 'if (existing)', '기존 pending 레코드와 Worker 재진입을 함께 검토합니다.'],
        ['src/capture/PaymentRetryWorker.ts', 'this.paymentCaptureService.capture', '재시도가 실제 gateway 호출로 이어지는지 추적합니다.'],
        ['src/webhooks/PaymentWebhookController.ts', 'async receive', '서명 검증과 raw body 계약을 먼저 읽습니다.'],
        ['src/webhooks/PaymentWebhookService.ts', 'this.transactionManager.run', '중복 이벤트의 트랜잭션 경계를 확인합니다.'],
        [webhook, 'where: { gatewayId', '이벤트 도착 순서와 상태 덮어쓰기를 비교합니다.'],
        ['src/reconciliation/ReconciliationWorker.ts', 'async tick', '배치 실행의 진입점부터 읽습니다.'],
        [reconcile, 'advanceCursor', '부분 실패 후 커서와 복구 경로를 확인합니다.'],
        ['src/shared/IdempotencyStore.ts', 'async acquire', '서로 다른 흐름에서 공유하는 lease 만료를 검토합니다.'],
      ].map(([path, text, reason]) => ({ path, line: lineOf(path, text), reason })),
      findings: [
        { path: capture, line: anchors.capture, severity: 'high', title: 'pending 결제가 재시도 경로를 막나요?',
          reason: '기존 레코드를 바로 반환합니다. Worker가 같은 메서드를 다시 호출하므로 pending → gateway 재호출 경로를 함께 확인하고 통합 테스트를 추가해 보세요.' },
        { path: 'src/capture/PaymentRetryWorker.test.ts', line: lineOf('src/capture/PaymentRetryWorker.test.ts', 'mockResolvedValue'), severity: 'medium', title: 'Service mock 밖의 재시도도 검증해 보세요',
          reason: '현재 테스트는 pending 응답을 mock합니다. 실제 저장된 pending capture로 Worker와 Service를 함께 실행하는 사례가 필요합니다.' },
        { path: webhook, line: anchors.webhook, severity: 'high', title: '지연된 이벤트가 최신 상태를 덮어쓰나요?',
          reason: '중복 ID는 제거하지만 update 조건에는 sequence 비교가 없습니다. refunded 이후 captured 이벤트가 늦게 도착하는 역순 시나리오를 검토하세요.' },
        { path: reconcile, line: anchors.reconcile, severity: 'high', title: '부분 실패를 건너뛰고 커서가 전진하나요?',
          reason: '실패한 settlement도 포함한 마지막 ID로 커서를 이동합니다. 다음 배치에서 실패 ID를 다시 처리할 durable retry 경로를 확인하세요.' },
        { path: 'src/shared/IdempotencyStore.ts', line: lineOf('src/shared/IdempotencyStore.ts', '30000'), severity: 'medium', title: 'lease 시간과 전체 처리 시간이 일치하나요?',
          reason: '30초 lease를 여러 흐름이 공유합니다. gateway 지연과 트랜잭션 대기를 포함한 최대 시간, 만료 중 중복 요청 테스트를 확인하세요.' },
      ],
    },
  };
}
