import mongoose, { Schema } from "mongoose";

const tableSchema = new Schema(
  {
    tableNumber: { type: Number, required: true, unique: true, min: 1 },
    label: { type: String, required: true, trim: true },
    qrToken: { type: String, required: true, unique: true, index: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Table = mongoose.models.Table || mongoose.model("Table", tableSchema);
