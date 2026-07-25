import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { Order } from "../src/models/Order";
import {
  createIdempotentOrderTrackingToken,
  fingerprintOrderRequest,
  hashOrderIdempotencyKey,
  IdempotencyConflictError
} from "../src/services/orderIdempotencyService";
import { createLocalOrderIdempotently } from "../src/services/localOrderStore";

let storeRoot = "";
let storeFile = "";

before(async () => {
  storeRoot = await mkdtemp(path.join(os.tmpdir(), "al-arab-orders-"));
  storeFile = path.join(storeRoot, "orders.json");
});

after(async () => {
  if (storeRoot) await rm(storeRoot, { recursive: true, force: true });
});

const customerId = "507f1f77bcf86cd799439011";
const idempotencyKey = "checkout-attempt-1234567890";
const idempotencyKeyHash = hashOrderIdempotencyKey(
  customerId,
  idempotencyKey
);
const requestPayload = {
  items: [{ menuItem: "item-1", quantity: 2 }],
  orderType: "delivery",
  address: "Test address"
};
const idempotencyRequestHash = fingerprintOrderRequest(
  customerId,
  requestPayload
);

function orderInput(orderNumber: string) {
  return {
    orderNumber,
    customer: customerId,
    customerName: "Beta Customer",
    items: [{ name: "Mandi", quantity: 2, price: 449 }],
    subtotal: 898,
    total: 898,
    status: "placed",
    paymentMethod: "cash_on_delivery" as const,
    paymentStatus: "pending" as const,
    orderType: "delivery" as const,
    trackingTokenHash: "a".repeat(64),
    idempotencyKeyHash,
    idempotencyRequestHash,
    statusHistory: [{ status: "placed", at: new Date().toISOString() }]
  };
}

test("order idempotency values are stable for the same customer and request", () => {
  assert.equal(
    hashOrderIdempotencyKey(customerId, idempotencyKey),
    idempotencyKeyHash
  );
  assert.equal(
    fingerprintOrderRequest(customerId, {
      address: "Test address",
      orderType: "delivery",
      items: [{ quantity: 2, menuItem: "item-1" }]
    }),
    idempotencyRequestHash
  );
  assert.equal(
    createIdempotentOrderTrackingToken(customerId, idempotencyKey),
    createIdempotentOrderTrackingToken(customerId, idempotencyKey)
  );
});

test("repeated order attempts return the original local order", async () => {
  const first = await createLocalOrderIdempotently(
    orderInput("AR-IDEMPOTENT-1"),
    storeFile
  );
  const replay = await createLocalOrderIdempotently(
    orderInput("AR-IDEMPOTENT-2"),
    storeFile
  );

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.order.orderNumber, first.order.orderNumber);
});

test("simultaneous order attempts store exactly one order", async () => {
  const concurrentCustomer = "507f1f77bcf86cd799439012";
  const concurrentKeyHash = hashOrderIdempotencyKey(
    concurrentCustomer,
    "simultaneous-checkout-key"
  );
  const concurrentRequestHash = fingerprintOrderRequest(
    concurrentCustomer,
    requestPayload
  );
  const firstInput = {
    ...orderInput("AR-CONCURRENT-1"),
    customer: concurrentCustomer,
    idempotencyKeyHash: concurrentKeyHash,
    idempotencyRequestHash: concurrentRequestHash
  };
  const secondInput = {
    ...firstInput,
    orderNumber: "AR-CONCURRENT-2"
  };

  const results = await Promise.all([
    createLocalOrderIdempotently(firstInput, storeFile),
    createLocalOrderIdempotently(secondInput, storeFile)
  ]);

  assert.deepEqual(
    results.map((result) => result.replayed).sort(),
    [false, true]
  );
  assert.equal(results[0].order.orderNumber, results[1].order.orderNumber);

  const storedOrders = JSON.parse(await readFile(storeFile, "utf8")) as Array<{
    customer?: string;
  }>;
  assert.equal(
    storedOrders.filter((order) => order.customer === concurrentCustomer)
      .length,
    1
  );
});

test("reusing a checkout key with changed details is rejected", async () => {
  await assert.rejects(
    () =>
      createLocalOrderIdempotently(
        {
          ...orderInput("AR-IDEMPOTENT-3"),
          idempotencyRequestHash: fingerprintOrderRequest(customerId, {
            ...requestPayload,
            items: [{ menuItem: "item-1", quantity: 3 }]
          })
        },
        storeFile
      ),
    IdempotencyConflictError
  );
});

test("MongoDB schema has a unique customer-scoped idempotency index", () => {
  const index = Order.schema.indexes().find(
    ([fields]) =>
      fields.customer === 1 && fields.idempotencyKeyHash === 1
  );

  assert.ok(index);
  assert.equal(index[1].unique, true);
  assert.equal(index[1].name, "unique_customer_order_idempotency");
  assert.ok(index[1].partialFilterExpression);
});
