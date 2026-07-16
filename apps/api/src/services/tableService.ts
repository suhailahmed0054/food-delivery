import { randomBytes, randomUUID } from "crypto";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { Table } from "../models/Table";
import { writeJsonFileAtomic } from "./localFileStore";

export type RestaurantTable = {
  id: string;
  tableNumber: number;
  label: string;
  qrToken: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_TABLE_COUNT = 10;
const dataDir = path.resolve(__dirname, "../../data");
const dataFile = path.join(dataDir, "tables.json");

function createQrToken() {
  return randomBytes(24).toString("base64url");
}

function createDefaultTable(tableNumber: number): RestaurantTable {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    tableNumber,
    label: `Table ${tableNumber}`,
    qrToken: createQrToken(),
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
}

function createTableRecord(tableNumber: number, label?: string): RestaurantTable {
  return {
    ...createDefaultTable(tableNumber),
    label: label?.trim() || `Table ${tableNumber}`
  };
}

function isMongoConnected() {
  return Table.db.readyState === 1;
}

async function ensureLocalTables() {
  await mkdir(dataDir, { recursive: true });

  let tables: RestaurantTable[] = [];
  try {
    const stored = JSON.parse(await readFile(dataFile, "utf8")) as unknown;
    if (Array.isArray(stored)) {
      tables = stored.filter((table): table is RestaurantTable => {
        if (!table || typeof table !== "object") return false;
        const candidate = table as Partial<RestaurantTable>;
        return (
          typeof candidate.id === "string" &&
          typeof candidate.tableNumber === "number" &&
          typeof candidate.label === "string" &&
          typeof candidate.qrToken === "string" &&
          typeof candidate.isActive === "boolean"
        );
      });
    }
  } catch {
    tables = [];
  }

  let changed = false;
  for (let tableNumber = 1; tableNumber <= DEFAULT_TABLE_COUNT; tableNumber += 1) {
    if (!tables.some((table) => table.tableNumber === tableNumber)) {
      tables.push(createDefaultTable(tableNumber));
      changed = true;
    }
  }

  tables.sort((first, second) => first.tableNumber - second.tableNumber);
  if (changed || tables.length === 0) {
    await writeJsonFileAtomic(dataFile, tables);
  }

  return tables;
}

async function writeLocalTables(tables: RestaurantTable[]) {
  await mkdir(dataDir, { recursive: true });
  await writeJsonFileAtomic(dataFile, tables);
}

async function ensureMongoTables() {
  await Table.bulkWrite(
    Array.from({ length: DEFAULT_TABLE_COUNT }, (_, index) => {
      const tableNumber = index + 1;
      return {
        updateOne: {
          filter: { tableNumber },
          update: {
            $setOnInsert: {
              tableNumber,
              label: `Table ${tableNumber}`,
              qrToken: createQrToken(),
              isActive: true
            }
          },
          upsert: true
        }
      };
    })
  );
}

type TableDatabaseRecord = {
  _id: unknown;
  tableNumber: number;
  label: string;
  qrToken: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

function toRestaurantTable(value: TableDatabaseRecord): RestaurantTable {
  return {
    id: String(value._id),
    tableNumber: value.tableNumber,
    label: value.label,
    qrToken: value.qrToken,
    isActive: value.isActive,
    createdAt: value.createdAt?.toISOString(),
    updatedAt: value.updatedAt?.toISOString()
  };
}

export async function listRestaurantTables() {
  if (!isMongoConnected()) return ensureLocalTables();

  await ensureMongoTables();
  const tables = await Table.find({}).sort({ tableNumber: 1 }).lean();
  return (tables as unknown as TableDatabaseRecord[]).map(toRestaurantTable);
}

export async function createRestaurantTable(input: {
  tableNumber: number;
  label?: string;
}) {
  if (!isMongoConnected()) {
    const tables = await ensureLocalTables();
    if (tables.some((table) => table.tableNumber === input.tableNumber)) return null;

    const table = createTableRecord(input.tableNumber, input.label);
    tables.push(table);
    tables.sort((first, second) => first.tableNumber - second.tableNumber);
    await writeLocalTables(tables);
    return table;
  }

  await ensureMongoTables();
  const existing = await Table.findOne({ tableNumber: input.tableNumber }).lean();
  if (existing) return null;

  const table = await Table.create({
    tableNumber: input.tableNumber,
    label: input.label?.trim() || `Table ${input.tableNumber}`,
    qrToken: createQrToken(),
    isActive: true
  });
  return toRestaurantTable(table.toObject() as unknown as TableDatabaseRecord);
}

export async function resolveRestaurantTableToken(qrToken: string) {
  if (!isMongoConnected()) {
    const tables = await ensureLocalTables();
    return tables.find((table) => table.qrToken === qrToken && table.isActive) ?? null;
  }

  await ensureMongoTables();
  const table = await Table.findOne({ qrToken, isActive: true }).lean();
  return table ? toRestaurantTable(table as unknown as TableDatabaseRecord) : null;
}

export async function resolveLegacyTableNumber(tableNumber: number) {
  if (process.env.NODE_ENV === "production") return null;

  const tables = await listRestaurantTables();
  return tables.find((table) => table.tableNumber === tableNumber && table.isActive) ?? null;
}

export async function regenerateRestaurantTableToken(id: string) {
  const qrToken = createQrToken();
  const updatedAt = new Date().toISOString();

  if (!isMongoConnected()) {
    const tables = await ensureLocalTables();
    const index = tables.findIndex((table) => table.id === id);
    if (index === -1) return null;

    tables[index] = { ...tables[index], qrToken, updatedAt };
    await writeLocalTables(tables);
    return tables[index];
  }

  const table = await Table.findByIdAndUpdate(id, { qrToken }, { new: true, runValidators: true }).lean();
  return table ? toRestaurantTable(table as unknown as TableDatabaseRecord) : null;
}

export async function setRestaurantTableActive(id: string, isActive: boolean) {
  const updatedAt = new Date().toISOString();

  if (!isMongoConnected()) {
    const tables = await ensureLocalTables();
    const index = tables.findIndex((table) => table.id === id);
    if (index === -1) return null;

    tables[index] = { ...tables[index], isActive, updatedAt };
    await writeLocalTables(tables);
    return tables[index];
  }

  const table = await Table.findByIdAndUpdate(id, { isActive }, { new: true, runValidators: true }).lean();
  return table ? toRestaurantTable(table as unknown as TableDatabaseRecord) : null;
}
