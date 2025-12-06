
export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  regularPrice?: number;
  total: number;
  category: string;
}

export interface Receipt {
  id: string;
  merchant: string;
  date: string; // ISO String
  totalAmount: number;
  currency: string;
  paymentSource: 'Credit' | 'Debit' | 'Cash';
  items: ReceiptItem[];
  tags: string[];
  notes?: string;
  createdAt: number;
}

export interface User {
  id: string;
  username: string;
  createdAt?: string;
}

export interface OCRResult {
  merchant: string;
  date: string;
  total: number;
  currency: string;
  payment_method?: 'Credit' | 'Debit' | 'Cash';
  items: {
    name: string;
    qty: number;
    unit: string;
    price_per_unit: number;
    regular_price?: number;
    is_sale?: boolean;
    total_price: number;
    category: string;
  }[];
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  SCAN = 'SCAN',
  CONVERTER = 'CONVERTER',
  HISTORY = 'HISTORY'
}

export interface ExchangeRateConfig {
  usdToVnd: number;
}
