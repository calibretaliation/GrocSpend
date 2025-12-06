import { Receipt } from "../types";

const STORAGE_KEY = 'smart_spend_receipts';

export const getReceipts = (): Receipt[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveReceipt = (receipt: Receipt): void => {
  const receipts = getReceipts();
  // Check if updating existing
  const index = receipts.findIndex(r => r.id === receipt.id);
  if (index >= 0) {
    receipts[index] = receipt;
  } else {
    receipts.push(receipt);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
};

export const deleteReceipt = (id: string): void => {
  const receipts = getReceipts();
  const updated = receipts.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const clearAll = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};