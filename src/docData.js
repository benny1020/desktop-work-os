export const docContent = {
  "retry-policy": {
    callout:
      "Retries are safe only when the request has a stable idempotency key. Never retry a non-idempotent capture.",
    intro:
      "Transient failures are expected in distributed payment systems. This policy defines when we retry a request, how long we wait, and how we ensure a customer is charged only once.",
    section: "Retry behavior",
    headers: ["Condition", "Action", "Limit"],
    rows: [
      ["Network timeout / 502", "Retry with exponential backoff", "3 attempts"],
      ["Rate limited / 429", "Respect Retry-After", "60 seconds"],
      ["Validation failure / 4xx", "Return the original error", "No retry"],
    ],
    note: "Persist the idempotency key before the first attempt. The worker must check the current request state before contacting the gateway again.",
    code: "const delay = Math.min(1000 * 2 ** attempt, 30000);\nawait queue.schedule(request, { delay, idempotencyKey });",
  },
  "order-contract": {
    callout:
      "Public order statuses are stable API contracts. Internal payment states must be mapped explicitly before returning a response.",
    intro:
      "The v2 order API provides a consistent lifecycle for checkout and fulfillment clients. Internal events can introduce new states without changing the public response schema.",
    section: "Status mapping",
    headers: ["Internal state", "Public status", "Meaning"],
    rows: [
      ["PENDING", "pending", "Awaiting payment"],
      ["PAYMENT_CONFIRMED", "confirmed", "Payment captured"],
      ["FULFILLED", "fulfilled", "Order delivered"],
      ["REFUNDED", "refunded", "Funds returned"],
    ],
    note: "Unknown internal states should raise a typed error and produce a structured log. Do not silently convert an unknown state to pending. Preserve total, currency, and updatedAt in all responses.",
    code: 'GET /v2/orders/order_128\n{ "id": "order_128", "status": "confirmed", "currency": "KRW" }',
  },
  runbook: {
    callout:
      "Capture a trace ID and check the latest deployment before changing production. Coordinate with the current on-call engineer.",
    intro:
      "This runbook covers timeouts, connection pool exhaustion, and elevated capture failures in payment-api. Start with a bounded investigation window and preserve the evidence for the incident timeline.",
    section: "Investigation checklist",
    headers: ["Signal", "Check", "Owner"],
    rows: [
      ["Elevated 502 rate", "Compare with the latest deployment", "On call"],
      [
        "Pool utilization >80%",
        "Connection lifetime and release path",
        "Backend",
      ],
      ["Duplicate capture", "Idempotency key and gateway response", "Payments"],
    ],
    note: "Attach the log trace, deployment version, and relevant merge request to the incident. A rollback requires an explicit operator decision after assessing in-flight payments.",
    code: "service: payment-api\nlevel: ERROR\ntime: deployment - 5m … deployment + 15m",
  },
  postmortem: {
    callout:
      "A blameless review: the goal is to strengthen the system, not evaluate an individual.",
    intro:
      "On September 18, payment response latency increased for 22 minutes while a gateway connection pool was saturated. No duplicate captures were observed. The team restored normal latency by reducing worker concurrency.",
    section: "Timeline",
    headers: ["Time", "Observation", "Response"],
    rows: [
      ["10:14", "Latency alert fired", "On-call triage started"],
      ["10:22", "Pool saturation confirmed", "Worker concurrency reduced"],
      ["10:36", "Latency returned to baseline", "Recovery verified"],
    ],
    note: "Follow-up work includes pool utilization alerts, bounded retry behavior, and a runbook for degraded payment captures. Track completion in OPS-91 and link deployment evidence before closing.",
    code: "Follow-up: bounded retry budget\nOwner: Backend & platform\nVerification: load test + production observation",
  },
  onboarding: {
    callout:
      "Use the shared development environment and request the minimum service access needed for your first issue.",
    intro:
      "Backend engineering owns payment processing, order lifecycle APIs, and service reliability. This handbook connects the people, repositories, and rituals that support everyday work.",
    section: "Start here",
    headers: ["Area", "Resource", "Contact"],
    rows: [
      ["Payments", "payment-api / retry policy", "Mina Choi"],
      ["Orders", "order-api / v2 contract", "Daniel Lee"],
      ["Infrastructure", "Service runbooks / on-call", "Sarah Park"],
    ],
    note: "Pick a small issue in Sprint 24, discuss the acceptance criteria, and open a draft merge request early. Request review with a clear description and evidence of the behavior you tested.",
    code: "Daily standup: 09:00\nBackend sync: 11:30\nSprint planning: Friday 14:00",
  },
};
