import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "../models/User";

export function signAccessToken(user: { id: string; role: UserRole }) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtAccessSecret, { expiresIn: "15m" });
}

export function signRefreshToken(user: { id: string; role: UserRole }) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtRefreshSecret, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwtAccessSecret) as { sub: string; role: UserRole };
}
