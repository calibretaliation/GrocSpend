import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./db.js";

const rawTtl = process.env.SESSION_TTL_DAYS;
const parsedTtl = rawTtl === undefined || rawTtl === "" ? null : Number(rawTtl);
let SESSION_TTL_DAYS: number | null = null;
if (parsedTtl !== null && Number.isFinite(parsedTtl) && parsedTtl > 0) {
  SESSION_TTL_DAYS = parsedTtl;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
}

export const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => bcrypt.compare(password, hash);

export const createSession = async (userId: string) => {
  const token = randomBytes(48).toString("hex");
  const expiresAt = SESSION_TTL_DAYS
    ? new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
    : null;

  await query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );

  return { token, expiresAt };
};

export const deleteSession = async (token: string) => {
  await query(`DELETE FROM sessions WHERE token = $1`, [token]);
};

export const getUserByToken = async (
  token: string
): Promise<AuthenticatedUser | null> => {
  const { rows } = await query<{
    id: string;
    username: string;
  }>(
    `SELECT u.id, u.username
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND (s.expires_at IS NULL OR s.expires_at > NOW())`,
    [token]
  );

  return rows[0] || null;
};

export const requireAuth = async (
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthenticatedUser | null> => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(401).json({ error: "Missing Authorization header." });
    return null;
  }

  const [, token] = authHeader.split(" ");
  if (!token) {
    res.status(401).json({ error: "Invalid Authorization header." });
    return null;
  }

  const user = await getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired session." });
    return null;
  }

  return user;
};
