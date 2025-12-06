import type { VercelRequest, VercelResponse } from "@vercel/node";
import { deleteSession } from "../../lib/auth";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    res.status(200).json({ success: true });
    return;
  }

  const [, token] = authHeader.split(" ");
  if (token) {
    await deleteSession(token);
  }

  res.status(200).json({ success: true });
}
