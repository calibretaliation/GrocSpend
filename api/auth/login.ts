import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../../lib/db.js";
import { createSession, verifyPassword } from "../../lib/auth.js";

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

  const { rows } = await query<{
    id: string;
    username: string;
    password_hash: string;
  }>(`SELECT id, username, password_hash FROM users WHERE username = $1`, [
    username,
  ]);

  if (rows.length === 0) {
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }

  const user = rows[0];
  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }

  const session = await createSession(user.id);

  res.status(200).json({
    token: session.token,
    user: { id: user.id, username: user.username },
  });
}
