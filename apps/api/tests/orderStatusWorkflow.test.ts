import assert from "node:assert/strict";
import test from "node:test";
import { getAllowedNextOrderStatuses } from "../src/services/orderStatusWorkflow";

test("delivery orders follow the complete admin workflow", () => {
  assert.deepEqual(
    getAllowedNextOrderStatuses("placed", "delivery", "admin"),
    ["accepted", "cancelled"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("accepted", "delivery", "admin"),
    ["preparing", "cancelled"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("preparing", "delivery", "admin"),
    ["ready", "cancelled"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("ready", "delivery", "admin"),
    ["out_for_delivery", "cancelled"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("out_for_delivery", "delivery", "admin"),
    ["delivered"]
  );
});

test("dine-in orders skip out for delivery", () => {
  assert.deepEqual(
    getAllowedNextOrderStatuses("pending", "dine_in", "admin"),
    ["accepted", "cancelled"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("accepted", "dine_in", "admin"),
    ["preparing", "cancelled"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("preparing", "dine_in", "admin"),
    ["ready", "cancelled"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("ready", "dine_in", "admin"),
    ["delivered"]
  );
});

test("completed, cancelled, and unknown statuses cannot advance", () => {
  assert.deepEqual(
    getAllowedNextOrderStatuses("delivered", "delivery", "admin"),
    []
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("cancelled", "delivery", "admin"),
    []
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("unknown", "delivery", "admin"),
    []
  );
});

test("kitchen staff remain limited to kitchen workflow steps", () => {
  assert.deepEqual(
    getAllowedNextOrderStatuses("placed", "delivery", "kitchen"),
    ["preparing"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("preparing", "delivery", "kitchen"),
    ["ready", "ready_for_pickup"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("ready", "delivery", "kitchen"),
    []
  );
});
