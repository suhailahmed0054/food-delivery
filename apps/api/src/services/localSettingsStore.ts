import { mkdir, readFile } from "fs/promises";
import path from "path";
import { writeJsonFileAtomic } from "./localFileStore";

export type RestaurantSettingsData = {
  restaurantName: string;
  phone: string;
  address: string;
  openingTime: string;
  closingTime: string;
  deliveryEnabled: boolean;
  dineInEnabled: boolean;
  restaurantOpen: boolean;
  deliveryFee: number;
  taxRate: number;
  minimumOrder: number;
  cashEnabled: boolean;
  onlinePaymentEnabled: boolean;
  whatsappTemplate: string;
  updatedAt?: string;
};

export const legacyWhatsAppTemplate =
  "New Al-Arab delivery: {{orderNumber}} for {{customerName}} at {{address}}.";

export const defaultDeliveryWhatsAppTemplate = [
  "*Al-Arab Delivery Assignment*",
  "Order: {{orderNumber}}",
  "",
  "Customer: {{customerName}}",
  "Phone: {{phone}}",
  "Delivery location: {{locationLink}}",
  "",
  "*Ordered items*",
  "{{items}}",
  "",
  "Total amount: {{total}}",
  "Payment status: {{paymentStatus}}"
].join("\n");

export const defaultRestaurantSettings: RestaurantSettingsData = {
  restaurantName: "Al-Arab Restaurant",
  phone: "+91 98765 43210",
  address: "Vijayapura, Devanahalli, Karnataka - 562135",
  openingTime: "11:00",
  closingTime: "23:00",
  deliveryEnabled: true,
  dineInEnabled: true,
  restaurantOpen: false,
  deliveryFee: 39,
  taxRate: 0.05,
  minimumOrder: 299,
  cashEnabled: true,
  onlinePaymentEnabled: true,
  whatsappTemplate: defaultDeliveryWhatsAppTemplate
};

const dataDir = path.resolve(__dirname, "../../data");
const dataFile = path.join(dataDir, "settings.json");

export async function readLocalSettings() {
  await mkdir(dataDir, { recursive: true });
  try {
    const parsed = JSON.parse(await readFile(dataFile, "utf8")) as Partial<RestaurantSettingsData>;
    const settings = { ...defaultRestaurantSettings, ...parsed };
    if (settings.whatsappTemplate === legacyWhatsAppTemplate) {
      settings.whatsappTemplate = defaultDeliveryWhatsAppTemplate;
      await writeJsonFileAtomic(dataFile, settings);
    }
    return settings;
  } catch {
    await writeJsonFileAtomic(dataFile, defaultRestaurantSettings);
    return defaultRestaurantSettings;
  }
}

export async function writeLocalSettings(settings: RestaurantSettingsData) {
  await mkdir(dataDir, { recursive: true });
  const next = { ...settings, updatedAt: new Date().toISOString() };
  await writeJsonFileAtomic(dataFile, next);
  return next;
}
