import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../../lib/db";
import { createSession, hashPassword } from "../../lib/auth";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  const { username, password } = body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  if (password.length < 6) {
    res
      .status(400)
      .json({ error: "Password must be at least 6 characters long." });
    return;
  }

  const existing = await query<{ id: string }>(
    `SELECT id FROM users WHERE username = $1`,
    [username]
  );

  if (existing.rows.length > 0) {
    res.status(409).json({ error: "Username is already taken." });
    return;
  }

  const passwordHash = await hashPassword(password);
  const { rows } = await query<{ id: string; username: string }>(
    `INSERT INTO users (username, password_hash)
     VALUES ($1, $2)
     RETURNING id, username`,
    [username, passwordHash]
  );

  const user = rows[0];
  const session = await createSession(user.id);

  res.status(201).json({
    token: session.token,
    user,
  });
}
