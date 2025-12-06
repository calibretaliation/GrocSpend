import { Receipt } from "../types";
import type { AuthorizedFetch } from "../contexts/AuthContext";

const BASE_PATH = "/api/receipts";

const parseError = async (response: Response) => {
  const message = await response.text();
  return message || response.statusText || "Request failed";
};

export const getReceipts = async (
  authFetch: AuthorizedFetch
): Promise<Receipt[]> => {
  const response = await authFetch(BASE_PATH);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as Receipt[];
};

export const saveReceipt = async (
  receipt: Receipt,
  authFetch: AuthorizedFetch
): Promise<Receipt> => {
  const response = await authFetch(BASE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(receipt),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as Receipt;
};

export const deleteReceipt = async (
  id: string,
  authFetch: AuthorizedFetch
): Promise<void> => {
  const response = await authFetch(`${BASE_PATH}/${id}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(await parseError(response));
  }
};