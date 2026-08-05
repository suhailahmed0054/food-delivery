import { readFile } from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { connectDatabase, isDatabaseConnected } from "../config/db";
import { MenuItem } from "../models/MenuItem";
import { uploadMenuImageToCloudinary } from "../services/cloudinaryService";

const legacyMenuImagePattern = /^\/uploads\/menu\/([a-zA-Z0-9._-]+)\.(jpe?g|png|webp)$/i;
const webMenuUploadDirectory = path.resolve(
  __dirname,
  "../../../web/public/uploads/menu"
);

function mimeTypeForExtension(extension: string) {
  if (/^jpe?g$/i.test(extension)) return "image/jpeg";
  if (/^png$/i.test(extension)) return "image/png";
  return "image/webp";
}

async function migrateMenuImages() {
  await connectDatabase();
  if (!isDatabaseConnected()) {
    throw new Error("MongoDB must be connected to migrate menu images");
  }

  const menuItems = await MenuItem.find({
    image: { $regex: "^/uploads/menu/" }
  }).select("_id name image");
  let migrated = 0;

  for (const menuItem of menuItems) {
    const match = menuItem.image.match(legacyMenuImagePattern);
    if (!match) {
      console.warn(`Skipped unsupported legacy image for ${menuItem.name}`);
      continue;
    }

    const [, fileName, extension] = match;
    const localPath = path.join(
      webMenuUploadDirectory,
      `${fileName}.${extension}`
    );
    const imageBuffer = await readFile(localPath);
    const uploaded = await uploadMenuImageToCloudinary(
      imageBuffer,
      mimeTypeForExtension(extension)
    );
    const updated = await MenuItem.updateOne(
      { _id: menuItem._id, image: menuItem.image },
      { $set: { image: uploaded.imageUrl, imagePublicId: uploaded.publicId } }
    );

    if (updated.modifiedCount === 1) {
      migrated += 1;
      console.log(`Migrated menu image for ${menuItem.name}`);
    }
  }

  console.log(
    `Menu image migration complete: ${migrated}/${menuItems.length} migrated.`
  );
}

void migrateMenuImages()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Menu image migration failed"
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
