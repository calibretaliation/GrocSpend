import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "crypto";
import { query, withTransaction } from "../../lib/db";
import { requireAuth } from "../../lib/auth";

const normalizeNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const user = await requireAuth(req, res);
  if (!user) return;

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
       WHERE r.user_id = $1
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [user.id]
    );

    const receipts = rows.map((row: any) => ({
      id: row.id,
      merchant: row.merchant,
      date: row.date.toISOString().split("T")[0],
      totalAmount: normalizeNumber(row.total_amount),
      currency: row.currency,
      paymentSource: row.payment_source,
      tags: row.tags ?? [],
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at).getTime(),
      items: (row.items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        quantity: normalizeNumber(item.quantity, 1),
        unit: item.unit,
        unitPrice: normalizeNumber(item.unitPrice),
        regularPrice:
          item.regularPrice !== null && item.regularPrice !== undefined
            ? normalizeNumber(item.regularPrice)
            : undefined,
        total: normalizeNumber(item.total),
        category: item.category,
      })),
    }));

    res.status(200).json(receipts);
    return;
  }

  if (req.method === "POST") {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    const receipt = body as {
      id?: string;
      merchant?: string;
      date?: string;
      totalAmount?: number;
      currency?: string;
      paymentSource?: string;
      tags?: string[];
      notes?: string;
      createdAt?: number;
      items?: Array<{
        id?: string;
        name?: string;
        quantity?: number;
        unit?: string;
        unitPrice?: number;
        regularPrice?: number | null;
        total?: number;
        category?: string;
      }>;
    };

    if (!receipt.merchant || !receipt.date || !receipt.totalAmount) {
      res.status(400).json({ error: "Invalid receipt payload." });
      return;
    }

    const receiptId = receipt.id || randomUUID();
    const createdAt = receipt.createdAt
      ? new Date(receipt.createdAt)
      : new Date();

    const saved = await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO receipts (
            id, user_id, merchant, date, total_amount,
            currency, payment_source, tags, notes, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id)
         DO UPDATE SET merchant = EXCLUDED.merchant,
                       date = EXCLUDED.date,
                       total_amount = EXCLUDED.total_amount,
                       currency = EXCLUDED.currency,
                       payment_source = EXCLUDED.payment_source,
                       tags = EXCLUDED.tags,
                       notes = EXCLUDED.notes,
                       created_at = EXCLUDED.created_at
         RETURNING id`,
        [
          receiptId,
          user.id,
          receipt.merchant,
          receipt.date,
          receipt.totalAmount,
          receipt.currency || "USD",
          receipt.paymentSource || "Credit",
          receipt.tags || [],
          receipt.notes ?? null,
          createdAt,
        ]
      );

      await client.query(`DELETE FROM receipt_items WHERE receipt_id = $1`, [
        receiptId,
      ]);

      const items = receipt.items || [];
      if (items.length) {
        const insertValues: any[] = [];
        const valueStrings: string[] = [];
        items.forEach((item, idx) => {
          const base = idx * 9;
          const itemId = item.id || randomUUID();
          valueStrings.push(
            `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
              base + 5
            }, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`
          );
          insertValues.push(
            itemId,
            receiptId,
            item.name || "",
            item.quantity ?? 1,
            item.unit || "ea",
            item.unitPrice ?? 0,
            item.regularPrice ?? null,
            item.total ?? 0,
            item.category || "Other"
          );
        });

        await client.query(
          `INSERT INTO receipt_items (
             id, receipt_id, name, quantity, unit,
             unit_price, regular_price, total, category
           ) VALUES ${valueStrings.join(",")}`,
          insertValues
        );
      }

      return receiptId;
    });

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
      [saved, user.id]
    );

    const row: any = rows[0];

    res.status(200).json({
      id: row.id,
      merchant: row.merchant,
      date: row.date.toISOString().split("T")[0],
      totalAmount: normalizeNumber(row.total_amount),
      currency: row.currency,
      paymentSource: row.payment_source,
      tags: row.tags ?? [],
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at).getTime(),
      items: (row.items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        quantity: normalizeNumber(item.quantity, 1),
        unit: item.unit,
        unitPrice: normalizeNumber(item.unitPrice),
        regularPrice:
          item.regularPrice !== null && item.regularPrice !== undefined
            ? normalizeNumber(item.regularPrice)
            : undefined,
        total: normalizeNumber(item.total),
        category: item.category,
      })),
    });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method Not Allowed" });
}
