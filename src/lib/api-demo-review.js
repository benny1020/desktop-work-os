import { parseDiff } from './review-model.mjs';

const sources = {
  'src/payments/PaymentController.ts': `import { Controller, Post, Body } from '@nestjs/common';
import { PaymentService } from './PaymentService';

@Controller('payments')
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  @Post('capture')
  async capture(@Body() request: CaptureRequest) {
    const payment = await this.service.capture(request);
    return { paymentId: payment.id, status: payment.status };
  }

  @Post('refund')
  async refund(@Body() request: RefundRequest) {
    const refund = await this.service.refund(request);
    return { refundId: refund.id, status: refund.status };
  }
}`,
  'src/payments/PaymentService.ts': `import { PaymentRepository } from './PaymentRepository';
import { PaymentGateway } from './PaymentGateway';
import { PaymentAuditService } from './PaymentAuditService';

export class PaymentService {
  constructor(private readonly repository: PaymentRepository,
    private readonly gateway: PaymentGateway,
    private readonly audit: PaymentAuditService) {}

  async capture(request: CaptureRequest) {
    const existing = await this.repository.findCapture(request.key);
    if (existing) return existing;
    const result = await this.gateway.authorize(request);
    const payment = await this.repository.saveCapture(result);
    await this.audit.record(payment);
    return payment;
  }

  async refund(request: RefundRequest) {
    const payment = await this.repository.findPayment(request.paymentId);
    if (!payment) throw new Error('Payment not found');
    if (request.amount > payment.remainingAmount) {
      throw new Error('Refund exceeds captured amount');
    }
    const result = await this.gateway.refund(request);
    const refund = await this.repository.saveRefund(result);
    await this.audit.record(refund);
    return refund;
  }
}`,
  'src/payments/PaymentRepository.ts': `export class PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCapture(key: string) {
    return this.prisma.payment.findUnique({ where: { key } });
  }

  async saveCapture(result: CaptureResult) {
    return this.prisma.$transaction(async tx => {
      const payment = await tx.payment.create({ data: result });
      await tx.outbox.create({ data: { type: 'captured', id: payment.id } });
      return payment;
    });
  }

  async findPayment(id: string) {
    return this.prisma.payment.findUnique({ where: { id } });
  }

  async saveRefund(result: RefundResult) {
    return this.prisma.$transaction(async tx => {
      const refund = await tx.refund.create({ data: result });
      await tx.payment.update({ where: { id: result.paymentId },
        data: { remainingAmount: { decrement: result.amount } } });
      return refund;
    });
  }
}`,
  'src/payments/PaymentGateway.ts': `export class PaymentGateway {
  constructor(private readonly client: GatewayClient) {}

  async authorize(request: CaptureRequest) {
    return this.client.capture({ amount: request.amount, key: request.key });
  }

  async refund(request: RefundRequest) {
    return this.client.refund({ paymentId: request.paymentId,
      amount: request.amount, key: request.key });
  }
}`,
  'src/payments/PaymentAuditService.ts': `import { AuditRepository } from './AuditRepository';

export class PaymentAuditService {
  constructor(private readonly repository: AuditRepository) {}

  async record(result: PaymentResult) {
    return this.repository.append({ id: result.id, status: result.status });
  }
}`,
  'src/payments/AuditRepository.ts': `export class AuditRepository {
  constructor(private readonly events: EventStore) {}

  async append(event: PaymentEvent) {
    return this.events.write(event);
  }
}`,
  'docs/payment-contract.md': `# Payment response contract

Capture returns paymentId and status. Refund returns refundId and status.
Both APIs accept a caller-provided idempotency key.
Refund amount must not exceed the remaining captured amount.
Audit writes happen after the payment transaction; discuss retry behavior.
`,
};
export const apiDemoFiles = Object.entries(sources).map(([path, content]) => {
  const contextOnly = /PaymentAuditService|AuditRepository/.test(path);
  const diff = contextOnly ? '' : `@@ -0,0 +1,${content.split('\n').length} @@\n` + content.split('\n').map(line => '+' + line).join('\n');
  return { path, new_path: path, old_path: path, content, diff, rows: parseDiff(diff), contextOnly, new_file: !contextOnly };
});
export const apiDemoMR = { id: '452', title: 'Separate capture and refund request paths', repo: 'payment-api', author: 'Mina Choi', status: 'In review', ci: 'Passed', comments: 0, updated: '8m ago', issue: 'PAY-382', files: apiDemoFiles.filter(file => !file.contextOnly).length, added: apiDemoFiles.reduce((sum, file) => sum + file.rows.filter(row => row.kind === 'added').length, 0), removed: 0 };
export function apiDemoSnapshot(mr = apiDemoMR) {
  const at = (path, text) => sources[path].split('\n').findIndex(line => line.includes(text)) + 1;
  const service = 'src/payments/PaymentService.ts', audit = 'src/payments/PaymentAuditService.ts';
  return {
    mr: { id: mr.id, iid: mr.id, project_id: mr.repo, title: mr.title, status: mr.status,
      source_branch: 'feat/capture-refund-contracts', target_branch: 'main',
      diff_refs: { base_sha: 'b452'.padEnd(40, '0'), start_sha: 'b452'.padEnd(40, '0'), head_sha: 'a452'.padEnd(40, '0') } },
    files: apiDemoFiles.filter(file => !file.contextOnly), contextFiles: apiDemoFiles.filter(file => file.contextOnly), discussions: [],
    demoGuide: { summary: '승인과 환불은 같은 클래스를 공유하지만 서로 다른 요청 경로입니다. 현재 API의 메서드만 읽고 응답·멱등성·저장 경계와 트랜잭션 이후 감사 기록을 확인하세요.', dependencies: [], sequence: [],
      readingOrder: [
        { path: service, line: at(service, 'async capture'), reason: '승인 요청의 멱등성과 gateway 호출을 확인하세요.' },
        { path: service, line: at(service, 'async refund'), reason: '환불 금액 검증과 응답 계약을 확인하세요.' },
        { path: audit, line: at(audit, 'async record'), reason: '변경되지 않은 감사 기록 메서드까지 추적하세요.' },
      ], findings: [
        { path: service, line: at(service, 'if (existing)'), title: '기존 pending 승인도 바로 반환하나요?', severity: 'medium', reason: '기존 결제 상태에 따라 재시도 요청이 gateway를 다시 호출해야 하는지 확인하세요.' },
        { path: service, line: at(service, 'request.amount >'), title: '동시 환불에서 잔여 금액이 보호되나요?', severity: 'high', reason: '금액 검증과 decrement 사이에 경쟁 요청이 들어오는 사례를 검토하세요.' },
        { path: audit, line: at(audit, 'repository.append'), title: '감사 기록 실패 이후 재시도는 안전한가요?', severity: 'medium', reason: '결제 트랜잭션 이후 감사 기록이 실패했을 때 응답과 중복 이벤트를 검토하세요.' },
      ] },
  };
}
