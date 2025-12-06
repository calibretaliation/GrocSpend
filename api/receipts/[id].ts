import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { id } = req.query;
  if (typeof id !== "string") {
    res.status(400).json({ error: "Invalid receipt id." });
    return;
  }

  if (req.method === "DELETE") {
    await query(`DELETE FROM receipts WHERE id = $1 AND user_id = $2`, [
      id,
      user.id,
    ]);
    res.status(204).end();
    return;
  }

  if (req.method === "GET") {
    const { rows } = await query(
      `SELECT r.id,
              r.merchant,
              r.date,
              r.total_amount,
              r.currency,
              r.payment_source,
              r.tags,
              r.notes,
              r.created_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', i.id,
                    'name', i.name,
                    'quantity', i.quantity,
                    'unit', i.unit,
                    'unitPrice', i.unit_price,
                    'regularPrice', i.regular_price,
                    'total', i.total,
                    'category', i.category
                  )
                ) FILTER (WHERE i.id IS NOT NULL),
                '[]'
              ) AS items
       FROM receipts r
       LEFT JOIN receipt_items i ON i.receipt_id = r.id
       WHERE r.id = $1 AND r.user_id = $2
       GROUP BY r.id`,
      [id, user.id]
    );

    if (!rows.length) {
      res.status(404).json({ error: "Receipt not found." });
      return;
    }

    const row: any = rows[0];

    res.status(200).json({
      id: row.id,
      merchant: row.merchant,
      date: row.date.toISOString().split("T")[0],
      totalAmount: Number(row.total_amount),
      currency: row.currency,
      paymentSource: row.payment_source,
      tags: row.tags ?? [],
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at).getTime(),
      items: (row.items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        regularPrice:
          item.regularPrice !== null && item.regularPrice !== undefined
            ? Number(item.regularPrice)
            : undefined,
        total: Number(item.total),
        category: item.category,
      })),
    });
    return;
  }

  res.setHeader("Allow", "GET, DELETE");
  res.status(405).json({ error: "Method Not Allowed" });
}
