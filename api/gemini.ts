import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import { OCRResult } from "../types";
import { requireAuth } from "../lib/auth.js";

const SYSTEM_INSTRUCTION = `
You are an advanced OCR expert for grocery receipts. Your task is to extract data into a strict JSON format by following these steps:

1.  **Identify the Merchant**: Look for the store name at the top of the receipt.
2.  **Identify the Date**: Find the date of transaction and convert it to ISO YYYY-MM-DD format.
3.  **Identify the Total**: Find the final grand total amount paid.
4.  **Identify Payment Method**: Look for keywords like "Cash", "Credit", "Visa", "MasterCard", "Amex", "Debit", "Change". Default to "Credit" if unsure.
5.  **Extract Line Items**: Go through the receipt line by line. For each item found:
  *   Extract the **Product Name**.
  *   Extract the **Quantity**. If not explicitly stated, infer 1.
  *   Extract the **Unit**:
    *   Look for explicit measures (e.g., 1 lb, 2.5 kg, 10 oz, 1 gallon, liter, ml).
    *   If the product name implies a weight (e.g., "Ribeye 1.5lb"), extract "lb" as the unit.
    *   Reason through the context to select the most appropriate standardized unit (ea, pack, bag, box, lb, oz, kg, g, L, mL, dozen, etc.).
    *   Only default to 'ea' when there is no evidence for a more specific measurement.
  *   **Identify Sales & Discounts**:
    *   Check for keywords like "Savings", "Discount", "Sale", "Reg Price", or "You Save".
    *   If a discount implies a **Regular Price** (higher than paid price), extract that original price into \`regular_price\`.
    *   If the item is on sale, set \`is_sale\` to true.
  *   Extract the **Unit Price**. This must be the **final effective price** the user paid (after immediate discounts).
  *   Extract the **Line Total** price.
  *   Infer a **Category** based on the item name (e.g., Groceries, Dining, Household, Utilities, Transport).
  *   **Sales Tax & Fees**: If you see "TAX", "Sales Tax", or similar fees, add them as a dedicated line item with name "Sales Tax" (or the printed label), quantity 1, unit 'ea', and the exact amount charged.
6.  **Review**: Ensure all numbers are parsed as numbers, not strings, and that the sum of line totals plus tax equals the overall receipt total.

**Output Rules:**
*   Output strictly raw JSON. No Markdown code blocks.
*   The JSON structure must be:
    {
      "merchant": "string",
      "date": "YYYY-MM-DD",
      "total": number,
      "currency": "USD",
      "payment_method": "Credit" | "Debit" | "Cash",
      "items": [
        { 
          "name": "string", 
          "qty": number, 
          "unit": "string", 
          "price_per_unit": number, 
          "regular_price": number | null, 
          "is_sale": boolean,
          "total_price": number, 
          "category": "string" 
        }
      ]
    }
*   If text is unclear, infer from context but prefer accuracy.
`;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Gemini API key is not configured." });
    return;
  }

  const body =
    typeof req.body === "string"
      ? (JSON.parse(req.body) as { image?: string })
      : ((req.body || {}) as { image?: string });

  const { image } = body;
  if (!image || typeof image !== "string") {
    res.status(400).json({ error: "Missing receipt image payload." });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: image,
            },
          },
          {
            text: "Perform OCR on this receipt image. Pay close attention to unit measures (lb, oz) and look for sales/discounts to extract the original regular price.",
          },
          {
            text: "Before answering, explicitly reason about the measurement unit for each line item and choose the best-fitting standardized unit (ea, pack, bag, box, lb, oz, kg, g, L, mL, dozen, etc.).",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) {
      res.status(502).json({ error: "No response from Gemini." });
      return;
    }

    const data = JSON.parse(text) as OCRResult;
    res.status(200).json(data);
  } catch (error) {
    console.error("Gemini API Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
