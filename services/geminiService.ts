
import { OCRResult } from "../types";

export const analyzeReceiptImage = async (base64Image: string): Promise<OCRResult> => {
  try {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Failed to analyze receipt.");
    }

    const data = await response.json();
    return data as OCRResult;
  } catch (error) {
    console.error("Gemini proxy error", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to analyze receipt."
    );
  }
};
