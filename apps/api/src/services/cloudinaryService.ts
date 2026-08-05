import { createHash, randomUUID } from "crypto";
import { env } from "../config/env";

const CLOUDINARY_UPLOAD_TIMEOUT_MS = 20_000;
const CLOUDINARY_MENU_FOLDER = "al-arab/menu";
const CLOUDINARY_SUPPORT_FOLDER = "al-arab/support";

type CloudinaryUploadResponse = {
  secure_url?: unknown;
  public_id?: unknown;
  error?: { message?: unknown };
};

export class ImageStorageConfigurationError extends Error {}

function signedUploadParameters(parameters: Record<string, string>) {
  return Object.entries(parameters)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function requireCloudinaryConfiguration() {
  if (
    !env.cloudinaryCloudName ||
    !env.cloudinaryApiKey ||
    !env.cloudinaryApiSecret
  ) {
    throw new ImageStorageConfigurationError(
      "Cloudinary image storage is not configured"
    );
  }
  return {
    cloudName: env.cloudinaryCloudName,
    apiKey: env.cloudinaryApiKey,
    apiSecret: env.cloudinaryApiSecret
  };
}

async function uploadImageToCloudinary(
  imageBuffer: Buffer,
  mimeType: string,
  folder: string
) {
  const configuration = requireCloudinaryConfiguration();

  const timestamp = String(Math.floor(Date.now() / 1000));
  const publicId = `${Date.now()}-${randomUUID()}`;
  const signedParameters = {
    folder,
    public_id: publicId,
    timestamp
  };
  const signature = createHash("sha1")
    .update(
      `${signedUploadParameters(signedParameters)}${configuration.apiSecret}`
    )
    .digest("hex");
  const form = new URLSearchParams({
    ...signedParameters,
    api_key: configuration.apiKey,
    signature,
    file: `data:${mimeType};base64,${imageBuffer.toString("base64")}`
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(configuration.cloudName)}/image/upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(CLOUDINARY_UPLOAD_TIMEOUT_MS)
    }
  );
  const payload = (await response.json()) as CloudinaryUploadResponse;
  const secureUrl =
    typeof payload.secure_url === "string" ? payload.secure_url : "";
  const uploadedPublicId =
    typeof payload.public_id === "string" ? payload.public_id : "";

  if (!response.ok || !secureUrl || !uploadedPublicId) {
    const providerMessage =
      typeof payload.error?.message === "string"
        ? payload.error.message
        : `Cloudinary returned ${response.status}`;
    throw new Error(providerMessage);
  }

  const imageUrl = new URL(secureUrl);
  if (
    imageUrl.protocol !== "https:" ||
    imageUrl.hostname !== "res.cloudinary.com"
  ) {
    throw new Error("Cloudinary returned an invalid image URL");
  }

  return { imageUrl: imageUrl.toString(), publicId: uploadedPublicId };
}

export function uploadMenuImageToCloudinary(
  imageBuffer: Buffer,
  mimeType: string
) {
  return uploadImageToCloudinary(imageBuffer, mimeType, CLOUDINARY_MENU_FOLDER);
}

export function uploadSupportImageToCloudinary(
  imageBuffer: Buffer,
  mimeType: string
) {
  return uploadImageToCloudinary(imageBuffer, mimeType, CLOUDINARY_SUPPORT_FOLDER);
}

export function cloudinaryPublicIdFromUrl(imageUrl: string) {
  if (!env.cloudinaryCloudName) return undefined;
  try {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") {
      return undefined;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== env.cloudinaryCloudName) return undefined;
    const uploadIndex = segments.indexOf("upload");
    if (uploadIndex < 0) return undefined;
    const assetSegments = segments
      .slice(uploadIndex + 1)
      .filter((segment, index) => !(index === 0 && /^v\d+$/.test(segment)));
    if (assetSegments.length === 0) return undefined;
    const publicId = decodeURIComponent(assetSegments.join("/"))
      .replace(/\.[a-zA-Z0-9]+$/, "");
    return publicId.startsWith("al-arab/") ? publicId : undefined;
  } catch {
    return undefined;
  }
}

export async function deleteCloudinaryImage(publicId: string) {
  const configuration = requireCloudinaryConfiguration();
  if (!/^al-arab\/(?:menu|support)\/[a-zA-Z0-9/_-]+$/.test(publicId)) {
    throw new Error("Refusing to delete an image outside the Al-Arab folders");
  }
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signedParameters = { public_id: publicId, timestamp };
  const signature = createHash("sha1")
    .update(`${signedUploadParameters(signedParameters)}${configuration.apiSecret}`)
    .digest("hex");
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(configuration.cloudName)}/image/destroy`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...signedParameters,
        api_key: configuration.apiKey,
        signature
      }),
      signal: AbortSignal.timeout(CLOUDINARY_UPLOAD_TIMEOUT_MS)
    }
  );
  if (!response.ok) {
    throw new Error(`Cloudinary delete returned ${response.status}`);
  }
}
