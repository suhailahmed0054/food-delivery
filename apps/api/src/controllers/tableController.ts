import { Request, Response } from "express";
import { z } from "zod";
import {
  listRestaurantTables,
  createRestaurantTable,
  regenerateRestaurantTableToken,
  resolveLegacyTableNumber,
  resolveRestaurantTableToken,
  setRestaurantTableActive
} from "../services/tableService";

const tableTokenSchema = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{16,128}$/).optional(),
  legacyTableNumber: z.coerce.number().int().min(1).max(999).optional()
}).refine((value) => Boolean(value.token || value.legacyTableNumber), {
  message: "A table token is required"
});

const tableActiveSchema = z.object({
  isActive: z.boolean()
});

const createTableSchema = z.object({
  tableNumber: z.coerce.number().int().min(1).max(999),
  label: z.string().trim().min(1).max(100).optional()
});

function routeId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export async function resolveTable(req: Request, res: Response) {
  const parsed = tableTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid table QR code" });
  }

  const table = parsed.data.token
    ? await resolveRestaurantTableToken(parsed.data.token)
    : await resolveLegacyTableNumber(parsed.data.legacyTableNumber!);

  if (!table) {
    return res.status(404).json({ message: "This table QR code is invalid or inactive" });
  }

  return res.json({
    id: table.id,
    tableNumber: table.tableNumber,
    label: table.label,
    ...(parsed.data.legacyTableNumber ? { token: table.qrToken } : {})
  });
}

export async function listTables(_req: Request, res: Response) {
  return res.json(await listRestaurantTables());
}

export async function createTable(req: Request, res: Response) {
  const parsed = createTableSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Enter a valid table number between 1 and 999",
      errors: parsed.error.flatten()
    });
  }

  const table = await createRestaurantTable(parsed.data);
  if (!table) {
    return res.status(409).json({ message: `Table ${parsed.data.tableNumber} already exists` });
  }
  return res.status(201).json(table);
}

export async function regenerateTableToken(req: Request, res: Response) {
  const table = await regenerateRestaurantTableToken(routeId(req));
  if (!table) return res.status(404).json({ message: "Table not found" });
  return res.json(table);
}

export async function updateTable(req: Request, res: Response) {
  const parsed = tableActiveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid table update" });

  const table = await setRestaurantTableActive(routeId(req), parsed.data.isActive);
  if (!table) return res.status(404).json({ message: "Table not found" });
  return res.json(table);
}
