import Razorpay from "razorpay";
import { env } from "../config/env";

let razorpayClient: Razorpay | null | undefined;

export function getRazorpayClient() {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) return null;
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: env.razorpayKeyId,
      key_secret: env.razorpayKeySecret
    });
  }
  return razorpayClient;
}
