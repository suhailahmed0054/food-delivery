import { randomUUID } from "crypto";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { writeJsonFileAtomic } from "./localFileStore";
import type { DeliveryPersonStatus } from "../models/DeliveryPerson";

export type LocalDeliveryPerson = {
  id: string;
  name: string;
  phone: string;
  status: DeliveryPersonStatus;
  createdAt: string;
  updatedAt: string;
};

const dataDir = path.resolve(__dirname, "../../data");
const dataFile = path.join(dataDir, "delivery-people.json");

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeJsonFileAtomic(dataFile, []);
  }
}

async function writeDeliveryPeople(deliveryPeople: LocalDeliveryPerson[]) {
  await ensureStore();
  await writeJsonFileAtomic(dataFile, deliveryPeople);
}

export async function listLocalDeliveryPeople() {
  await ensureStore();

  try {
    const parsed = JSON.parse(await readFile(dataFile, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as LocalDeliveryPerson[]) : [];
  } catch {
    return [];
  }
}

export async function getLocalDeliveryPerson(id: string) {
  const deliveryPeople = await listLocalDeliveryPeople();
  return deliveryPeople.find((person) => person.id === id) ?? null;
}

export async function createLocalDeliveryPerson(input: {
  name: string;
  phone: string;
  status: DeliveryPersonStatus;
}) {
  const deliveryPeople = await listLocalDeliveryPeople();
  if (deliveryPeople.some((person) => person.phone === input.phone)) return null;

  const now = new Date().toISOString();
  const person: LocalDeliveryPerson = {
    id: randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now
  };
  await writeDeliveryPeople([person, ...deliveryPeople]);
  return person;
}

export async function updateLocalDeliveryPerson(
  id: string,
  input: { name: string; phone: string; status: DeliveryPersonStatus }
) {
  const deliveryPeople = await listLocalDeliveryPeople();
  const index = deliveryPeople.findIndex((person) => person.id === id);
  if (index === -1) return null;
  if (deliveryPeople.some((person) => person.id !== id && person.phone === input.phone)) {
    return "duplicate" as const;
  }

  deliveryPeople[index] = {
    ...deliveryPeople[index],
    ...input,
    updatedAt: new Date().toISOString()
  };
  await writeDeliveryPeople(deliveryPeople);
  return deliveryPeople[index];
}

export async function setLocalDeliveryPersonStatus(
  id: string,
  status: DeliveryPersonStatus
) {
  const deliveryPeople = await listLocalDeliveryPeople();
  const index = deliveryPeople.findIndex((person) => person.id === id);
  if (index === -1) return null;

  deliveryPeople[index] = {
    ...deliveryPeople[index],
    status,
    updatedAt: new Date().toISOString()
  };
  await writeDeliveryPeople(deliveryPeople);
  return deliveryPeople[index];
}

export async function deleteLocalDeliveryPerson(id: string) {
  const deliveryPeople = await listLocalDeliveryPeople();
  const nextDeliveryPeople = deliveryPeople.filter((person) => person.id !== id);
  if (nextDeliveryPeople.length === deliveryPeople.length) return false;

  await writeDeliveryPeople(nextDeliveryPeople);
  return true;
}
