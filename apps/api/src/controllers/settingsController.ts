import { Request, Response } from "express";
import { z } from "zod";
import { RestaurantSettings } from "../models/RestaurantSettings";
import {
  defaultDeliveryWhatsAppTemplate,
  defaultRestaurantSettings,
  legacyWhatsAppTemplate,
  readLocalSettings,
  writeLocalSettings
} from "../services/localSettingsStore";

const settingsSchema = z.object({
  restaurantName: z.string().trim().min(2).max(150),
  phone: z.string().trim().min(8).max(30),
  address: z.string().trim().min(5).max(500),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/),
  deliveryEnabled: z.boolean(),
  dineInEnabled: z.boolean(),
  restaurantOpen: z.boolean(),
  deliveryFee: z.coerce.number().finite().min(0).max(10000),
  taxRate: z.coerce.number().finite().min(0).max(1),
  minimumOrder: z.coerce.number().finite().min(0).max(100000),
  cashEnabled: z.boolean(),
  onlinePaymentEnabled: z.boolean(),
  whatsappTemplate: z.string().trim().max(2000)
});

function isMongoConnected() {
  return RestaurantSettings.db.readyState === 1;
}

function withCodOnlySettings<T extends { onlinePaymentEnabled: boolean }>(settings: T) {
  return { ...settings, onlinePaymentEnabled: false };
}

export async function getSettings(_req: Request, res: Response) {
  if (!isMongoConnected()) {
    return res.json(withCodOnlySettings(await readLocalSettings()));
  }

  const settings = await RestaurantSettings.findOneAndUpdate(
    { key: "restaurant" },
    { $setOnInsert: { key: "restaurant", ...defaultRestaurantSettings } },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  if (settings?.whatsappTemplate === legacyWhatsAppTemplate) {
    settings.whatsappTemplate = defaultDeliveryWhatsAppTemplate;
    await RestaurantSettings.updateOne(
      { key: "restaurant" },
      { whatsappTemplate: defaultDeliveryWhatsAppTemplate }
    );
  }
  return res.json(settings ? withCodOnlySettings(settings) : settings);
}

export async function updateSettings(req: Request, res: Response) {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid restaurant settings",
      errors: parsed.error.flatten()
    });
  }

  const codOnlySettings = withCodOnlySettings(parsed.data);

  if (!isMongoConnected()) {
    return res.json(await writeLocalSettings(codOnlySettings));
  }

  const settings = await RestaurantSettings.findOneAndUpdate(
    { key: "restaurant" },
    { key: "restaurant", ...codOnlySettings },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  return res.json(settings);
}
