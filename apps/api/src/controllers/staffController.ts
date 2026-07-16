import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { DeliveryPerson } from "../models/DeliveryPerson";
import {
  createLocalDeliveryPerson,
  deleteLocalDeliveryPerson,
  listLocalDeliveryPeople,
  updateLocalDeliveryPerson
} from "../services/localDeliveryPersonStore";

const deliveryPersonSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .min(10)
    .max(20)
    .refine((phone) => {
      const digits = phone.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }, "Enter a valid WhatsApp phone number"),
  status: z.enum(["available", "busy", "offline"]).default("available")
});

function isMongoConnected() {
  return DeliveryPerson.db.readyState === 1;
}

function routeId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function serializeDeliveryPerson(value: unknown) {
  const person = value as {
    _id?: unknown;
    id?: string;
    name: string;
    phone: string;
    status: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };
  return {
    id: person.id ?? String(person._id),
    name: person.name,
    phone: person.phone,
    status: person.status,
    createdAt:
      person.createdAt instanceof Date
        ? person.createdAt.toISOString()
        : person.createdAt,
    updatedAt:
      person.updatedAt instanceof Date
        ? person.updatedAt.toISOString()
        : person.updatedAt
  };
}

export async function listDeliveryPeople(_req: Request, res: Response) {
  if (!isMongoConnected()) {
    const people = await listLocalDeliveryPeople();
    return res.json(people);
  }

  const people = await DeliveryPerson.find({}).sort({ createdAt: -1 }).lean();
  return res.json(people.map((person) => serializeDeliveryPerson(person)));
}

export async function createDeliveryPerson(req: Request, res: Response) {
  const parsed = deliveryPersonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid delivery person details",
      errors: parsed.error.flatten()
    });
  }

  if (!isMongoConnected()) {
    const person = await createLocalDeliveryPerson(parsed.data);
    if (!person) {
      return res.status(409).json({ message: "This WhatsApp number is already in use" });
    }
    return res.status(201).json(person);
  }

  const existing = await DeliveryPerson.findOne({ phone: parsed.data.phone }).lean();
  if (existing) {
    return res.status(409).json({ message: "This WhatsApp number is already in use" });
  }

  const person = await DeliveryPerson.create(parsed.data);
  return res.status(201).json(serializeDeliveryPerson(person));
}

export async function updateDeliveryPerson(req: Request, res: Response) {
  const parsed = deliveryPersonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid delivery person details",
      errors: parsed.error.flatten()
    });
  }

  const id = routeId(req);
  if (!isMongoConnected()) {
    const person = await updateLocalDeliveryPerson(id, parsed.data);
    if (person === "duplicate") {
      return res.status(409).json({ message: "This WhatsApp number is already in use" });
    }
    if (!person) return res.status(404).json({ message: "Delivery person not found" });
    return res.json(person);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Delivery person not found" });
  }
  const duplicate = await DeliveryPerson.findOne({
    _id: { $ne: id },
    phone: parsed.data.phone
  }).lean();
  if (duplicate) {
    return res.status(409).json({ message: "This WhatsApp number is already in use" });
  }

  const person = await DeliveryPerson.findByIdAndUpdate(id, parsed.data, {
    new: true,
    runValidators: true
  }).lean();
  if (!person) return res.status(404).json({ message: "Delivery person not found" });
  return res.json(serializeDeliveryPerson(person));
}

export async function deleteDeliveryPerson(req: Request, res: Response) {
  const id = routeId(req);
  if (!isMongoConnected()) {
    const deleted = await deleteLocalDeliveryPerson(id);
    if (!deleted) return res.status(404).json({ message: "Delivery person not found" });
    return res.status(204).send();
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Delivery person not found" });
  }
  const person = await DeliveryPerson.findByIdAndDelete(id);
  if (!person) return res.status(404).json({ message: "Delivery person not found" });
  return res.status(204).send();
}
