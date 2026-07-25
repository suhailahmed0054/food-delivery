import { randomUUID } from "crypto";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import type { UserRole } from "../models/User";
import { writeJsonFileAtomic } from "./localFileStore";

export type CustomerAddress = {
  id: string;
  label: string;
  address: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
};

export type CustomerNotificationPreferences = {
  orderUpdates: boolean;
  offers: boolean;
};

export type LocalAccount = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  role: UserRole;
  addresses: CustomerAddress[];
  notificationPreferences: CustomerNotificationPreferences;
  refreshTokenHash?: string;
  isBlocked: boolean;
  blockedAt?: string;
  blockReason?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
};

const defaultDataFile = path.resolve(__dirname, "../../data/customer-accounts.json");
const dataFile = process.env.LOCAL_ACCOUNT_DATA_FILE
  ? path.resolve(process.env.LOCAL_ACCOUNT_DATA_FILE)
  : defaultDataFile;
const dataDir = path.dirname(dataFile);
let writeQueue = Promise.resolve();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeJsonFileAtomic(dataFile, []);
  }
}

export async function listLocalAccounts() {
  await ensureStore();
  try {
    const parsed = JSON.parse(await readFile(dataFile, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as LocalAccount[]) : [];
  } catch {
    return [];
  }
}

async function writeLocalAccounts(accounts: LocalAccount[]) {
  const operation = writeQueue.then(async () => {
    await ensureStore();
    await writeJsonFileAtomic(dataFile, accounts);
  });
  writeQueue = operation.catch(() => undefined);
  await operation;
}

export async function findLocalAccountById(id: string) {
  const accounts = await listLocalAccounts();
  return accounts.find((account) => account.id === id) ?? null;
}

export async function findLocalAccountByEmail(email: string) {
  const normalized = normalizeEmail(email);
  const accounts = await listLocalAccounts();
  return accounts.find((account) => account.email === normalized) ?? null;
}

export async function createLocalAccount(input: {
  name: string;
  email: string;
  emailVerified?: boolean;
}) {
  const accounts = await listLocalAccounts();
  const email = normalizeEmail(input.email);
  if (accounts.some((account) => account.email === email)) return null;

  const now = new Date().toISOString();
  const account: LocalAccount = {
    id: `customer-${randomUUID()}`,
    name: input.name.trim(),
    email,
    emailVerified: input.emailVerified ?? false,
    role: "customer",
    addresses: [],
    notificationPreferences: { orderUpdates: true, offers: true },
    isBlocked: false,
    createdAt: now,
    updatedAt: now
  };
  await writeLocalAccounts([account, ...accounts]);
  return account;
}

export async function updateLocalAccount(
  id: string,
  update: Partial<Omit<LocalAccount, "id" | "createdAt" | "updatedAt">>
) {
  const accounts = await listLocalAccounts();
  const index = accounts.findIndex((account) => account.id === id);
  if (index === -1) return null;

  const email = update.email ? normalizeEmail(update.email) : undefined;
  if (
    email &&
    accounts.some((account, accountIndex) =>
      accountIndex !== index && account.email === email
    )
  ) {
    return null;
  }

  accounts[index] = {
    ...accounts[index],
    ...update,
    ...(email ? { email } : {}),
    updatedAt: new Date().toISOString()
  };
  await writeLocalAccounts(accounts);
  return accounts[index];
}
