import { parseDiff, buildGraph } from "./review-model.mjs";
import { complexDemoSnapshot } from './complex-demo-review.js';
const order = {
  "src/OrderController.ts": `import { OrderService } from './OrderService';\n\nexport class OrderController {\n  constructor(private readonly orderService: OrderService) {}\n\n  async getOrder(id: string) {\n    return this.orderService.getOrder(id);\n  }\n}`,
  "src/OrderService.ts": `import { StatusMapper } from './StatusMapper';\n\nexport class OrderService {\n  constructor(private readonly repository: OrderRepository) {}\n\n  async getOrder(id: string): Promise<OrderResponse> {\n    const order = await this.repository.findById(id);\n    if (!order) throw new OrderNotFoundError(id);\n\n    return {\n      id: order.id,\n      status: StatusMapper.toPublic(order.status),\n      total: order.total,\n      currency: order.currency,\n      updatedAt: order.updatedAt.toISOString(),\n    };\n  }\n}`,
  "src/StatusMapper.ts": `export class StatusMapper {\n  static toPublic(status: OrderStatus): PublicStatus {\n    const mapping: Record<OrderStatus, PublicStatus> = {\n      PENDING: 'pending',\n      PAYMENT_CONFIRMED: 'confirmed',\n      FULFILLED: 'fulfilled',\n      REFUNDED: 'refunded',\n      CANCELLED: 'cancelled',\n    };\n    const result = mapping[status];\n    if (!result) throw new UnknownOrderStatus(status);\n    return result;\n  }\n}`,
  "src/OrderService.test.ts": `import { OrderService } from './OrderService';\n\ndescribe('order status mapping', () => {\n  it('maps confirmed payment to confirmed', async () => {\n    repository.findById.mockResolvedValue({\n      ...orderFixture, status: 'PAYMENT_CONFIRMED',\n    });\n    const orderService = new OrderService(repository);\n    const order = await orderService.getOrder('order_128');\n    expect(order.status).toBe('confirmed');\n    expect(order.currency).toBe('KRW');\n  });\n});`,
};
const payment = {
  "src/PaymentController.ts": `import { PaymentService } from './PaymentService';\n\nexport class PaymentController {\n  constructor(private readonly paymentService: PaymentService) {}\n  async capture(request: CaptureRequest) {\n    return this.paymentService.capture(request);\n  }\n}`,
  "src/PaymentService.ts": `import { RetryQueue } from './RetryQueue';\n\nexport class PaymentService {\n  constructor(private readonly gateway: PaymentGateway,\n    private readonly retryQueue: RetryQueue) {}\n  async capture(request: CaptureRequest) {\n    const existing = await this.findCapture(request.idempotencyKey);\n    if (existing) return existing;\n    try {\n      return await this.gateway.capture(request);\n    } catch (error) {\n      if (!isRetryable(error)) throw error;\n      await this.retryQueue.enqueue({ ...request, attempt: 1 });\n      return { status: 'pending', key: request.idempotencyKey };\n    }\n  }\n}`,
  "src/RetryQueue.ts": `export class RetryQueue {\n  async enqueue(job: RetryJob) {\n    const delayMs = Math.min(1000 * 2 ** job.attempt, 30000);\n    return this.queue.add('capture', job, {\n      delay: delayMs,\n      jobId: job.idempotencyKey,\n    });\n  }\n}`,
  "src/PaymentWorker.ts": `import { PaymentService } from './PaymentService';\n\nexport class PaymentWorker {\n  constructor(private readonly paymentService: PaymentService) {}\n  async process(job: RetryJob) {\n    if (job.attempt > 3) throw new RetryBudgetExceeded(job);\n    return this.paymentService.capture(job);\n  }\n}`,
};
export function demoSnapshot(mr) {
  if (String(mr.id) === '428') return complexDemoSnapshot(mr);
  const contents = String(mr.id) === "391" ? order : payment;
  const files = Object.entries(contents).map(([path, content]) => {
    const diff =
      `@@ -1,${content.split("\n").length} +1,${content.split("\n").length} @@\n` +
      content
        .split("\n")
        .map(
          (l, i) =>
            (i === 0 || /status:|retryQueue.enqueue|UnknownOrderStatus/.test(l)
              ? "+"
              : " ") + l,
        )
        .join("\n");
    return {
      path,
      new_path: path,
      old_path: path,
      new_file: false,
      deleted_file: false,
      diff,
      content,
      rows: parseDiff(diff),
    };
  });
  const graph = buildGraph(files);
  const target = files[1],
    last = files[2];
  const demoGuide = {
    summary:
      String(mr.id) === "391"
        ? "주문 응답의 상태 매핑을 별도 컴포넌트로 분리합니다. Controller → Service → Mapper 순서로 읽고, 기존 API 응답 계약과 알 수 없는 상태의 오류 경로를 확인하세요."
        : "결제 실패를 재시도 큐로 넘기고 Worker에서 처리합니다. 멱등성 키, 재시도 횟수 전달, 최대 지연과 최종 실패 경로를 우선 검토하세요.",
    readingOrder: [
      {
        path: files[0].path,
        line: 1,
        reason: "요청 진입점과 변경된 호출 경계를 확인합니다.",
      },
      {
        path: target.path,
        line: Math.min(7, target.rows.length - 1),
        reason: "주요 변경 로직과 기존 응답 계약을 비교합니다.",
      },
      {
        path: last.path,
        line: 2,
        reason: "예외 처리와 경계 조건을 확인합니다.",
      },
    ],
    dependencies: [],
    sequence: graph.sequence,
    findings: [
      {
        path: target.path,
        line: 7,
        severity: "high",
        title: "실패 경로와 응답 계약을 확인하세요",
        reason:
          "정상 경로 외에 데이터가 없거나 외부 호출이 실패할 때의 응답과 부작용을 점검하세요. 샘플 기반 제안이며 확인된 결함은 아닙니다.",
      },
      {
        path: last.path,
        line: 2,
        severity: "medium",
        title: "경계값에 대한 테스트를 확인하세요",
        reason:
          "정의되지 않은 입력이나 최대 재시도 경계에서 예상대로 종료하는지 검증하는 테스트가 필요합니다.",
      },
    ],
  };
  return {
    mr: {
      id: mr.id,
      iid: mr.id,
      project_id: mr.repo || "demo",
      title: mr.title,
      status: mr.status,
      source_branch:
        mr.id === "391" ? "fix/order-status" : "feat/payment-retry",
      target_branch: "main",
      diff_refs: {
        base_sha: "b20cd41demo0000000000000000000000000000000",
        start_sha: "b20cd41demo0000000000000000000000000000000",
        head_sha: "a38f921demo0000000000000000000000000000000",
      },
    },
    files,
    discussions: [],
    demoGuide,
  };
}
