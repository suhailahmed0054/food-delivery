import { createHash, randomUUID } from "crypto";
import { env } from "../config/env";

const CLOUDINARY_UPLOAD_TIMEOUT_MS = 20_000;
const CLOUDINARY_MENU_FOLDER = "al-arab/menu";

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

export async function uploadMenuImageToCloudinary(
  imageBuffer: Buffer,
  mimeType: string
) {
  if (
    !env.cloudinaryCloudName ||
    !env.cloudinaryApiKey ||
    !env.cloudinaryApiSecret
  ) {
    throw new ImageStorageConfigurationError(
      "Cloudinary image storage is not configured"
    );
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const publicId = `${Date.now()}-${randomUUID()}`;
  const signedParameters = {
    folder: CLOUDINARY_MENU_FOLDER,
    public_id: publicId,
    timestamp
  };
  const signature = createHash("sha1")
    .update(
      `${signedUploadParameters(signedParameters)}${env.cloudinaryApiSecret}`
    )
    .digest("hex");
  const form = new URLSearchParams({
    ...signedParameters,
    api_key: env.cloudinaryApiKey,
    signature,
    file: `data:${mimeType};base64,${imageBuffer.toString("base64")}`
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.cloudinaryCloudName)}/image/upload`,
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
