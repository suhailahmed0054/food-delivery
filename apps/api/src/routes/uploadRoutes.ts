import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  ImageStorageConfigurationError,
  uploadMenuImageToCloudinary
} from "../services/cloudinaryService";

const uploadRouter = Router();
const maxImageBytes = 3 * 1024 * 1024;

const imageUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  dataUrl: z.string().trim().min(1)
});

function hasExpectedImageSignature(imageBuffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return (
      imageBuffer.length >= 3 &&
      imageBuffer[0] === 0xff &&
      imageBuffer[1] === 0xd8 &&
      imageBuffer[2] === 0xff
    );
  }
  if (mimeType === "image/png") {
    return (
      imageBuffer.length >= 8 &&
      imageBuffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    );
  }
  if (mimeType === "image/webp") {
    return (
      imageBuffer.length >= 12 &&
      imageBuffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      imageBuffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

uploadRouter.post(
  "/menu-image",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const parsed = imageUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Choose a valid dish image" });
    }

    const match = parsed.data.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      return res.status(400).json({ message: "Only JPG, PNG, and WEBP images are supported" });
    }

    const [, mimeType, base64] = match;
    const imageBuffer = Buffer.from(base64, "base64");
    if (!hasExpectedImageSignature(imageBuffer, mimeType)) {
      return res.status(400).json({ message: "The selected file is not a valid image" });
    }
    if (imageBuffer.length > maxImageBytes) {
      return res.status(413).json({ message: "Dish image is too large. Please upload an image under 3MB." });
    }

    try {
      const uploaded = await uploadMenuImageToCloudinary(imageBuffer, mimeType);
      return res.status(201).json({ imageUrl: uploaded.imageUrl });
    } catch (error) {
      if (error instanceof ImageStorageConfigurationError) {
        return res.status(503).json({
          message: "Dish photo uploads are not configured yet"
        });
      }
      console.error(
        "Cloudinary menu image upload failed:",
        error instanceof Error ? error.message : "Unknown upload error"
      );
      return res.status(502).json({
        message: "Unable to store the dish photo. Please try again."
      });
    }
  })
);

export { uploadRouter };
