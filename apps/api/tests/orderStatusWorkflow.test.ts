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

test("dine-in orders use served and completed instead of delivery states", () => {
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
    ["served"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("served", "dine_in", "admin"),
    ["completed"]
  );
});

test("takeaway orders use collected and completed instead of delivery states", () => {
  assert.deepEqual(
    getAllowedNextOrderStatuses("placed", "takeaway", "admin"),
    ["accepted", "cancelled"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("preparing", "takeaway", "admin"),
    ["ready", "cancelled"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("ready_for_pickup", "takeaway", "admin"),
    ["collected", "cancelled"]
  );
  assert.deepEqual(
    getAllowedNextOrderStatuses("collected", "takeaway", "admin"),
    ["completed"]
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
    getAllowedNextOrderStatuses("completed", "takeaway", "admin"),
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
