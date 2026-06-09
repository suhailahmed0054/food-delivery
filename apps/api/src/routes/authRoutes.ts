import { Router } from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/User";
import { env } from "../config/env";
import { signAccessToken, signRefreshToken } from "../services/tokenService";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const passwordHash = await bcrypt.hash(req.body.password, 10);
  const user = await User.create({ name: req.body.name, email: req.body.email, passwordHash, role: "customer" });
  return res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken: signAccessToken({ id: user.id, role: user.role }),
    refreshToken: signRefreshToken({ id: user.id, role: user.role })
  });
});

authRouter.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user?.passwordHash) return res.status(401).json({ message: "Invalid credentials" });
  const matches = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!matches) return res.status(401).json({ message: "Invalid credentials" });
  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken: signAccessToken({ id: user.id, role: user.role }),
    refreshToken: signRefreshToken({ id: user.id, role: user.role })
  });
});

authRouter.post("/google", async (req, res) => {
  const client = new OAuth2Client(env.googleClientId);
  const ticket = await client.verifyIdToken({ idToken: req.body.idToken, audience: env.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.email) return res.status(401).json({ message: "Google account email is required" });

  const user = await User.findOneAndUpdate(
    { email: payload.email },
    { name: payload.name ?? "Google User", email: payload.email, googleId: payload.sub },
    { new: true, upsert: true }
  );

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken: signAccessToken({ id: user.id, role: user.role }),
    refreshToken: signRefreshToken({ id: user.id, role: user.role })
  });
});
