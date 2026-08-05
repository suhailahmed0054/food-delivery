import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { orderRouter } from "../src/routes/orderRoutes";
import { MenuItem } from "../src/models/MenuItem";
import { Notification } from "../src/models/Notification";
import { Order } from "../src/models/Order";
import { RestaurantSettings } from "../src/models/RestaurantSettings";
import { Table } from "../src/models/Table";
import { defaultRestaurantSettings } from "../src/services/localSettingsStore";
import { getOrderAuthenticationDecision } from "../src/services/orderAuthenticationService";
import {
  findOrderForTracking,
  hashOrderTrackingToken
} from "../src/services/orderTrackingService";
import { createIdempotentOrderTrackingToken } from "../src/services/orderIdempotencyService";

function orderRequest(orderType: "delivery" | "takeaway" | "dine_in") {
  return {
    items: [{ name: "Mandi", quantity: 1 }],
    orderType,
    customerName: "Guest Customer",
    ...(orderType === "delivery"
      ? { address: "Test address", deliveryLatitude: 13, deliveryLongitude: 77 }
      : {}),
    ...(orderType === "dine_in"
      ? { tableToken: "valid-looking-table-token" }
      : {})
  };
}

async function withOrderApi(
  run: (baseUrl: string) => Promise<void>
) {
  const app = express();
  app.use(express.json());
  app.use("/api/orders", orderRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function postGuestOrder(
  baseUrl: string,
  orderType: "delivery" | "takeaway" | "dine_in"
) {
  return fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `guest-${orderType}-checkout-1234567890`
    },
    body: JSON.stringify(orderRequest(orderType))
  });
}

test("order authentication policy permits only guest dine-in", () => {
  const dineIn = getOrderAuthenticationDecision("dine_in", undefined);
  const delivery = getOrderAuthenticationDecision("delivery", undefined);
  const takeaway = getOrderAuthenticationDecision("takeaway", undefined);

  assert.equal(dineIn.allowed, true);
  if (dineIn.allowed) {
    assert.equal(dineIn.isGuestOrder, true);
    assert.equal(dineIn.customerId, undefined);
  }
  assert.deepEqual(delivery, {
    allowed: false,
    status: 401,
    code: "ORDER_AUTHENTICATION_REQUIRED",
    message: "Please sign in to continue with delivery."
  });
  assert.deepEqual(takeaway, {
    allowed: false,
    status: 401,
    code: "ORDER_AUTHENTICATION_REQUIRED",
    message: "Please sign in to continue with takeaway."
  });
});

test("authenticated customers can use every order type", () => {
  for (const orderType of ["delivery", "takeaway", "dine_in"] as const) {
    const decision = getOrderAuthenticationDecision(orderType, {
      id: "507f1f77bcf86cd799439011",
      role: "customer"
    });
    assert.equal(decision.allowed, true);
    if (decision.allowed) {
      assert.equal(decision.customerId, "507f1f77bcf86cd799439011");
      assert.equal(decision.isGuestOrder, false);
    }
  }
});

test("guest delivery and takeaway API requests return typed 401 responses", async () => {
  await withOrderApi(async (baseUrl) => {
    for (const orderType of ["delivery", "takeaway"] as const) {
      const response = await postGuestOrder(baseUrl, orderType);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), {
        message: `Please sign in to continue with ${orderType}.`,
        code: "ORDER_AUTHENTICATION_REQUIRED",
        orderType
      });
    }
  });
});

test("guest dine-in reaches dine-in validation instead of authentication rejection", async () => {
  await withOrderApi(async (baseUrl) => {
    const response = await postGuestOrder(baseUrl, "dine_in");
    assert.notEqual(response.status, 401);
  });
});

test("valid guest dine-in API request creates an isolated guest order", async () => {
  const connection = Order.db as unknown as { _readyState: number };
  const previousReadyState = connection._readyState;
  const originals = {
    orderFindOne: Order.findOne,
    orderCreate: Order.create,
    menuFind: MenuItem.find,
    settingsFindOne: RestaurantSettings.findOne,
    tableBulkWrite: Table.bulkWrite,
    tableFindOne: Table.findOne,
    notificationFindOne: Notification.findOne,
    notificationCreate: Notification.create
  };
  let storedOrder: Record<string, unknown> | null = null;

  connection._readyState = 1;
  Object.assign(Order, {
    findOne: () => ({ select: async () => null }),
    create: async (input: Record<string, unknown>) => {
      storedOrder = input;
      const created = {
        ...input,
        _id: "507f1f77bcf86cd799439099",
        id: "507f1f77bcf86cd799439099",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return {
        ...created,
        toObject: () => ({ ...created })
      };
    }
  });
  Object.assign(MenuItem, {
    find: () => ({
      lean: async () => [{
        _id: "507f1f77bcf86cd799439010",
        name: "Mandi",
        price: 399,
        available: true,
        customization: {
          sizes: [{ name: "Standard", priceDelta: 0 }],
          spiceLevels: ["Regular"],
          addOns: []
        }
      }]
    })
  });
  Object.assign(RestaurantSettings, {
    findOne: () => ({
      lean: async () => ({
        ...defaultRestaurantSettings,
        restaurantOpen: true
      })
    })
  });
  Object.assign(Table, {
    bulkWrite: async () => undefined,
    findOne: () => ({
      lean: async () => ({
        _id: "507f1f77bcf86cd799439020",
        tableNumber: 7,
        label: "Table 7",
        qrToken: "valid-looking-table-token",
        isActive: true
      })
    })
  });
  Object.assign(Notification, {
    findOne: async () => null,
    create: async (input: Record<string, unknown>) => ({
      ...input,
      _id: "507f1f77bcf86cd799439030"
    })
  });

  try {
    await withOrderApi(async (baseUrl) => {
      const response = await postGuestOrder(baseUrl, "dine_in");
      const body = await response.json() as Record<string, unknown>;

      assert.equal(response.status, 201);
      assert.equal(storedOrder?.customer, undefined);
      assert.equal(storedOrder?.isGuestOrder, true);
      assert.equal(storedOrder?.tableNumber, "7");
      assert.equal(body.isGuestOrder, true);
      assert.equal(typeof body.trackingToken, "string");
      assert.equal(body.trackingTokenHash, undefined);
      assert.equal(body.idempotencyKeyHash, undefined);
    });
  } finally {
    connection._readyState = previousReadyState;
    Object.assign(Order, {
      findOne: originals.orderFindOne,
      create: originals.orderCreate
    });
    Object.assign(MenuItem, { find: originals.menuFind });
    Object.assign(RestaurantSettings, {
      findOne: originals.settingsFindOne
    });
    Object.assign(Table, {
      bulkWrite: originals.tableBulkWrite,
      findOne: originals.tableFindOne
    });
    Object.assign(Notification, {
      findOne: originals.notificationFindOne,
      create: originals.notificationCreate
    });
  }
});

test("one guest tracking token cannot access another guest order", async () => {
  const connection = Order.db as unknown as { _readyState: number };
  const previousReadyState = connection._readyState;
  const originalFindOne = Order.findOne;
  const firstToken = createIdempotentOrderTrackingToken(
    "guest-dine-in",
    "guest-tracking-checkout-111111"
  );
  const secondToken = createIdempotentOrderTrackingToken(
    "guest-dine-in",
    "guest-tracking-checkout-222222"
  );
  const firstHash = hashOrderTrackingToken(firstToken);

  connection._readyState = 1;
  Object.assign(Order, {
    findOne: (query: { orderNumber?: string; trackingTokenHash?: string }) => ({
      select: () => ({
        lean: async () =>
          query.orderNumber === "AR-GUEST-TRACK-1" &&
          query.trackingTokenHash === firstHash
            ? {
                orderNumber: "AR-GUEST-TRACK-1",
                trackingTokenHash: firstHash,
                isGuestOrder: true
              }
            : null
      })
    })
  });

  try {
    assert.ok(await findOrderForTracking("AR-GUEST-TRACK-1", firstToken));
    assert.equal(
      await findOrderForTracking("AR-GUEST-TRACK-1", secondToken),
      null
    );
  } finally {
    connection._readyState = previousReadyState;
    Object.assign(Order, { findOne: originalFindOne });
  }
});
