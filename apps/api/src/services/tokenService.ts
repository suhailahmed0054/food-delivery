import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "../models/User";

const tokenIssuer = "al-arab-api";
const tokenAudience = "al-arab-web";

export function signAccessToken(user: { id: string; role: UserRole }) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtAccessSecret, {
    expiresIn: "15m",
    issuer: tokenIssuer,
    audience: tokenAudience
  });
}

export function signRefreshToken(user: { id: string; role: UserRole }) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtRefreshSecret, {
    expiresIn: "7d",
    issuer: tokenIssuer,
    audience: tokenAudience
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwtAccessSecret, {
    issuer: tokenIssuer,
    audience: tokenAudience
  }) as { sub: string; role: UserRole };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.jwtRefreshSecret, {
    issuer: tokenIssuer,
    audience: tokenAudience
  }) as { sub: string; role: UserRole };
}
