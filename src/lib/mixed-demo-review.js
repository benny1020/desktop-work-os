import { parseDiff } from './review-model.mjs';
const sources = {
  'src/settlement/controller/SettlementController.ts': `import { Controller, Post } from '@nestjs/common';
import { SettlementService } from '../application/SettlementService';
import { SettlementRequest } from '../dto/SettlementRequest';
@Controller('settlements')
export class SettlementController {
  constructor(private service: SettlementService) {}
  @Post('capture')
  async capture(request: SettlementRequest) {
    return this.service.capture(request);
  }
}`,
  'src/settlement/consumer/SettlementConsumer.ts': `import { EventPattern, Transport } from '@nestjs/microservices';
import { SettlementService } from '../application/SettlementService';
import { SettlementEvent } from '../dto/SettlementEvent';
export class SettlementConsumer {
  constructor(private service: SettlementService) {}
  @EventPattern('payments.captured.v2', Transport.KAFKA)
  async onCaptured(event: SettlementEvent) {
    // Broker retry / acknowledgment is configured outside this handler.
    return this.service.settle(event);
  }
}`,
  'src/settlement/job/ReconciliationJob.ts': `import { Cron } from '@nestjs/schedule';
import { SettlementService } from '../application/SettlementService';
export class ReconciliationJob {
  constructor(private service: SettlementService) {}
  @Cron('0 */15 * * * *')
  async reconcile() {
    // Multi-instance scheduling needs an external lock.
    return this.service.reconcile();
  }
}`,
  'src/settlement/application/SettlementService.ts': `import { SettlementDomainService } from '../domain/service/SettlementDomainService';
import { SettlementPersistenceAdapter } from '../adapter/out/persistence/SettlementPersistenceAdapter';
import { SettlementProducer } from '../producer/SettlementProducer';
import { BankAdapter } from '../adapter/out/BankAdapter';
import { SettlementRequest } from '../dto/SettlementRequest';
export class SettlementService {
  constructor(private policy: SettlementDomainService,
    private storage: SettlementPersistenceAdapter,
    private producer: SettlementProducer,
    private bank: BankAdapter) {}
  async capture(request: SettlementRequest) {
    this.policy.validate(request.amount);
    return this.bank.authorize(request.amount);
  }
  async settle(event: SettlementEvent) {
    const exists = await this.storage.find(event.id);
    if (exists) return exists;
    const amount = this.policy.netAmount(event.amount);
    const settlement = await this.storage.save(event.id, amount);
    await this.producer.publish(settlement);
    return settlement;
  }
  async reconcile() {
    const pending = await this.storage.pending();
    return { outstanding: pending.length };
  }
}`,
  'src/settlement/domain/service/SettlementDomainService.ts': `import { SettlementDomain } from '../SettlementDomain';
export class SettlementDomainService {
  constructor(private domain: SettlementDomain) {}
  validate(amount: number) {
    if (amount <= 0) throw new Error('Amount must be positive');
    return true;
  }
  netAmount(amount: number) {
    this.validate(amount);
    return this.domain.afterFee(amount);
  }
}`,
  'src/settlement/domain/SettlementDomain.ts': `export class SettlementDomain {
  afterFee(amount: number) {
    // Business invariant: settlement amount cannot fall below zero.
    return Math.max(0, Math.round(amount * 0.985));
  }
}`,
  'src/settlement/adapter/out/persistence/SettlementPersistenceAdapter.ts': `import { SettlementRepository } from '../../../repository/SettlementRepository';
import { SettlementEntity } from '../../../entity/SettlementEntity';
import { SettlementPort } from '../../../port/SettlementPort';
export class SettlementPersistenceAdapter implements SettlementPort {
  constructor(private repository: SettlementRepository) {}
  async find(id: string) { return this.repository.find(id); }
  async pending() { return this.repository.pending(); }
  async save(id: string, amount: number) {
    const record: SettlementEntity = { id, amount, status: 'settled' };
    return this.repository.save(record);
  }
}`,
  'src/settlement/repository/SettlementRepository.ts': `import { SettlementEntity } from '../entity/SettlementEntity';
export class SettlementRepository {
  constructor(private db: PrismaClient) {}
  async find(id: string) { return this.db.settlement.findUnique({ where: { id } }); }
  async pending() { return this.db.settlement.findMany({ where: { status: 'pending' } }); }
  async save(record: SettlementEntity) {
    return this.db.$transaction(async tx => {
      const saved = await tx.settlement.create({ data: record });
      await tx.outbox.create({ data: { topic: 'settlements.completed', id: saved.id } });
      return saved;
    });
  }
}`,
  'src/settlement/producer/SettlementProducer.ts': `import { SettlementModel } from '../model/SettlementModel';
export class SettlementProducer {
  constructor(private kafka: ClientKafka) {}
  async publish(settlement: SettlementModel) {
    // Dispatch ends this process's flow. The downstream consumer runs separately.
    return this.kafka.emit('settlements.completed', settlement);
  }
}`,
  'src/settlement/adapter/out/BankAdapter.ts': `export class BankAdapter {
  constructor(private bank: BankClient) {}
  async authorize(amount: number) { return this.bank.authorize(amount); }
}`,
  'src/settlement/port/SettlementPort.ts': `export interface SettlementPort {
  find(id: string): Promise<unknown>;
  save(id: string, amount: number): Promise<unknown>;
  pending(): Promise<unknown[]>;
}`,
  'src/settlement/dto/SettlementRequest.ts': `export interface SettlementRequest { amount: number; currency: 'KRW' | 'USD'; }`,
  'src/settlement/dto/SettlementEvent.ts': `export interface SettlementEvent { id: string; amount: number; eventVersion: 2; }`,
  'src/settlement/entity/SettlementEntity.ts': `export interface SettlementEntity { id: string; amount: number; status: 'pending' | 'settled'; }`,
  'src/settlement/model/SettlementModel.ts': `export interface SettlementModel { id: string; amount: number; }`,
  'src/core/money.ts': `export function roundMoney(value: number) {
  if (!Number.isFinite(value)) throw new Error('Non-finite amount');
  return Math.round(value * 100) / 100;
}
export function convertCurrency(value: number, rate: number) {
  return roundMoney(value * rate);
}`,
  'docs/settlement-delivery.md': `# Settlement delivery guarantees

The Kafka handler receives payments.captured.v2.
The outbox records settlements.completed in the database transaction.
Broker delivery, acknowledgment, external bank calls and scheduler locks are separate review boundaries.
`,
};
export const mixedDemoFiles = Object.entries(sources).map(([path, content]) => {
  const contextOnly = path === 'src/settlement/domain/SettlementDomain.ts';
  const diff = contextOnly ? '' : `@@ -0,0 +1,${content.split('\n').length} @@\n` + content.split('\n').map(line => '+' + line).join('\n');
  return { path, new_path: path, old_path: path, content, diff, rows: parseDiff(diff), contextOnly, new_file: !contextOnly };
});
export const mixedDemoMR = { id: '464', title: 'Unify settlement API, Kafka delivery and reconciliation', repo: 'payment-api', author: 'Mina Choi', status: 'In review', ci: 'Passed', comments: 0, updated: '3m ago', issue: 'PAY-382', files: mixedDemoFiles.filter(file => !file.contextOnly).length, added: mixedDemoFiles.reduce((n, f) => n + f.rows.filter(row => row.kind === 'added').length, 0), removed: 0 };
export function mixedDemoSnapshot(mr = mixedDemoMR) {
  const path = 'src/settlement/application/SettlementService.ts';
  const line = sources[path].split('\n').findIndex(text => text.includes('const exists')) + 1;
  return { mr: { id: mr.id, iid: mr.id, project_id: mr.repo, title: mr.title, status: mr.status, source_branch: 'feat/settlement-event-v2', target_branch: 'main', diff_refs: { base_sha: 'b464'.padEnd(40, '0'), start_sha: 'b464'.padEnd(40, '0'), head_sha: 'a464'.padEnd(40, '0') } }, files: mixedDemoFiles.filter(file => !file.contextOnly), contextFiles: mixedDemoFiles.filter(file => file.contextOnly), discussions: [], demoGuide: { summary: 'API·Kafka·정기 작업은 서로 다른 진입점입니다. Kafka의 중복 전달, 저장 트랜잭션, 발행 경계와 코어 금액 규칙을 각각 확인하세요.', dependencies: [], sequence: [], readingOrder: [{ path, line, reason: '중복 메시지 조회와 저장 사이의 경쟁 조건을 확인하세요.' }], findings: [{ path, line, title: '동시 Kafka 재전달에서 중복 저장이 가능한가요?', reason: '조회 이후 insert 사이에 동일 이벤트가 도착할 수 있습니다. id unique 제약과 재전달 처리를 확인하세요.', severity: 'high' }] } };
}
