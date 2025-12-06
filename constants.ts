import { ExchangeRateConfig } from "./types";

export const DEFAULT_EXCHANGE_RATE: ExchangeRateConfig = {
  usdToVnd: 25400,
};

export const CATEGORIES = [
  "Groceries",
  "Dining",
  "Utilities",
  "Household",
  "Transport",
  "Entertainment",
  "Other"
];

export const PAYMENT_SOURCES = ["Credit", "Debit", "Cash"] as const;

export const UNITS = ["lb", "kg", "oz", "g", "each", "box", "pkg"];