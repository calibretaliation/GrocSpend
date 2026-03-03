import type { Receipt } from '../types';

/**
 * Mock data for local dev mode (VITE_DEV_MODE=true).
 * Provides a debug user and realistic receipt data that exercises
 * Price History (multiple purchases of same items across merchants)
 * and Monthly/Custom Spend History (receipts spread across months).
 */

export const DEV_USER = {
    id: 'dev-user-001',
    username: 'debuguser',
    createdAt: '2025-10-01T00:00:00.000Z',
};

export const DEV_TOKEN = 'dev-mock-token-00000000';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

// Helper: create a date string YYYY-MM-DD relative to today
const daysAgo = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
};

export const DEV_RECEIPTS: Receipt[] = [
    // ── Recent receipts (within last 7 days) ──
    {
        id: uuid(1),
        merchant: 'Walmart',
        date: daysAgo(0),
        totalAmount: 47.82,
        currency: 'USD',
        paymentSource: 'Credit',
        items: [
            { id: uuid(101), name: 'Bananas', quantity: 1, unit: 'lb', unitPrice: 0.58, total: 0.58, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(102), name: 'Whole Milk', quantity: 1, unit: 'ea', unitPrice: 3.98, total: 3.98, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(103), name: 'Chicken Breast', quantity: 2.5, unit: 'lb', unitPrice: 3.49, regularPrice: 4.29, total: 8.73, category: 'Groceries', tags: ['meat', 'sale'] },
            { id: uuid(104), name: 'Bread', quantity: 1, unit: 'ea', unitPrice: 2.99, total: 2.99, category: 'Groceries', tags: [] },
            { id: uuid(105), name: 'Paper Towels', quantity: 1, unit: 'pack', unitPrice: 12.49, total: 12.49, category: 'Household', tags: [] },
            { id: uuid(106), name: 'Eggs', quantity: 1, unit: 'dozen', unitPrice: 4.29, total: 4.29, category: 'Groceries', tags: [] },
            { id: uuid(107), name: 'Avocados', quantity: 4, unit: 'ea', unitPrice: 1.25, total: 5.00, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(108), name: 'Rice', quantity: 1, unit: 'bag', unitPrice: 9.76, total: 9.76, category: 'Groceries', tags: ['grain'] },
        ],
        tags: ['weekly-shop'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    },
    {
        id: uuid(2),
        merchant: 'Trader Joe\'s',
        date: daysAgo(2),
        totalAmount: 32.15,
        currency: 'USD',
        paymentSource: 'Debit',
        items: [
            { id: uuid(201), name: 'Bananas', quantity: 1, unit: 'lb', unitPrice: 0.19, total: 0.19, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(202), name: 'Whole Milk', quantity: 1, unit: 'ea', unitPrice: 4.49, total: 4.49, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(203), name: 'Sourdough Bread', quantity: 1, unit: 'ea', unitPrice: 3.99, total: 3.99, category: 'Groceries', tags: [] },
            { id: uuid(204), name: 'Frozen Pizza', quantity: 2, unit: 'ea', unitPrice: 4.49, total: 8.98, category: 'Groceries', tags: ['frozen'] },
            { id: uuid(205), name: 'Orange Juice', quantity: 1, unit: 'ea', unitPrice: 3.99, total: 3.99, category: 'Groceries', tags: ['beverage'] },
            { id: uuid(206), name: 'Eggs', quantity: 1, unit: 'dozen', unitPrice: 3.99, total: 3.99, category: 'Groceries', tags: [] },
            { id: uuid(207), name: 'Avocados', quantity: 3, unit: 'ea', unitPrice: 0.99, total: 2.97, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(208), name: 'Greek Yogurt', quantity: 2, unit: 'ea', unitPrice: 1.79, total: 3.58, category: 'Groceries', tags: ['dairy'] },
        ],
        tags: [],
        createdAt: Date.now() - 172800000,
        updatedAt: Date.now() - 172800000,
    },
    {
        id: uuid(3),
        merchant: 'Costco',
        date: daysAgo(5),
        totalAmount: 156.74,
        currency: 'USD',
        paymentSource: 'Credit',
        items: [
            { id: uuid(301), name: 'Chicken Breast', quantity: 6, unit: 'lb', unitPrice: 2.99, total: 17.94, category: 'Groceries', tags: ['meat', 'bulk'] },
            { id: uuid(302), name: 'Rice', quantity: 1, unit: 'bag', unitPrice: 18.99, total: 18.99, category: 'Groceries', tags: ['grain', 'bulk'] },
            { id: uuid(303), name: 'Paper Towels', quantity: 1, unit: 'pack', unitPrice: 19.99, total: 19.99, category: 'Household', tags: ['bulk'] },
            { id: uuid(304), name: 'Eggs', quantity: 2, unit: 'dozen', unitPrice: 3.49, total: 6.98, category: 'Groceries', tags: ['bulk'] },
            { id: uuid(305), name: 'Whole Milk', quantity: 2, unit: 'ea', unitPrice: 3.29, total: 6.58, category: 'Groceries', tags: ['dairy', 'bulk'] },
            { id: uuid(306), name: 'Bananas', quantity: 3, unit: 'lb', unitPrice: 0.49, total: 1.47, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(307), name: 'Gasoline', quantity: 15, unit: 'ea', unitPrice: 3.45, total: 51.75, category: 'Transport', tags: [] },
            { id: uuid(308), name: 'Laundry Detergent', quantity: 1, unit: 'ea', unitPrice: 14.99, total: 14.99, category: 'Household', tags: ['bulk'] },
            { id: uuid(309), name: 'Avocados', quantity: 5, unit: 'ea', unitPrice: 0.80, total: 4.00, category: 'Groceries', tags: ['fruit', 'bulk'] },
            { id: uuid(310), name: 'Greek Yogurt', quantity: 4, unit: 'ea', unitPrice: 1.49, total: 5.96, category: 'Groceries', tags: ['dairy', 'bulk'] },
            { id: uuid(311), name: 'Butter', quantity: 2, unit: 'ea', unitPrice: 4.29, total: 8.58, category: 'Groceries', tags: ['dairy'] },
        ],
        tags: ['costco-run', 'bulk'],
        createdAt: Date.now() - 432000000,
        updatedAt: Date.now() - 432000000,
    },

    // ── Last month ──
    {
        id: uuid(4),
        merchant: 'Walmart',
        date: daysAgo(20),
        totalAmount: 62.47,
        currency: 'USD',
        paymentSource: 'Credit',
        items: [
            { id: uuid(401), name: 'Bananas', quantity: 2, unit: 'lb', unitPrice: 0.62, total: 1.24, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(402), name: 'Whole Milk', quantity: 1, unit: 'ea', unitPrice: 4.19, total: 4.19, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(403), name: 'Chicken Breast', quantity: 3, unit: 'lb', unitPrice: 4.29, total: 12.87, category: 'Groceries', tags: ['meat'] },
            { id: uuid(404), name: 'Bread', quantity: 2, unit: 'ea', unitPrice: 2.99, total: 5.98, category: 'Groceries', tags: [] },
            { id: uuid(405), name: 'Eggs', quantity: 2, unit: 'dozen', unitPrice: 5.49, total: 10.98, category: 'Groceries', tags: [] },
            { id: uuid(406), name: 'Orange Juice', quantity: 1, unit: 'ea', unitPrice: 4.59, total: 4.59, category: 'Groceries', tags: ['beverage'] },
            { id: uuid(407), name: 'Butter', quantity: 1, unit: 'ea', unitPrice: 4.99, total: 4.99, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(408), name: 'Rice', quantity: 1, unit: 'bag', unitPrice: 8.99, total: 8.99, category: 'Groceries', tags: ['grain'] },
            { id: uuid(409), name: 'Greek Yogurt', quantity: 3, unit: 'ea', unitPrice: 1.29, total: 3.87, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(410), name: 'Avocados', quantity: 4, unit: 'ea', unitPrice: 1.19, total: 4.76, category: 'Groceries', tags: ['fruit'] },
        ],
        tags: ['weekly-shop'],
        createdAt: Date.now() - 1728000000,
        updatedAt: Date.now() - 1728000000,
    },
    {
        id: uuid(5),
        merchant: 'Trader Joe\'s',
        date: daysAgo(25),
        totalAmount: 28.44,
        currency: 'USD',
        paymentSource: 'Debit',
        items: [
            { id: uuid(501), name: 'Bananas', quantity: 1, unit: 'lb', unitPrice: 0.19, total: 0.19, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(502), name: 'Frozen Pizza', quantity: 3, unit: 'ea', unitPrice: 4.49, total: 13.47, category: 'Groceries', tags: ['frozen'] },
            { id: uuid(503), name: 'Orange Juice', quantity: 1, unit: 'ea', unitPrice: 3.99, total: 3.99, category: 'Groceries', tags: ['beverage'] },
            { id: uuid(504), name: 'Sourdough Bread', quantity: 1, unit: 'ea', unitPrice: 3.99, total: 3.99, category: 'Groceries', tags: [] },
            { id: uuid(505), name: 'Eggs', quantity: 1, unit: 'dozen', unitPrice: 3.79, total: 3.79, category: 'Groceries', tags: [] },
            { id: uuid(506), name: 'Greek Yogurt', quantity: 2, unit: 'ea', unitPrice: 1.49, total: 2.98, category: 'Groceries', tags: ['dairy'] },
        ],
        tags: [],
        createdAt: Date.now() - 2160000000,
        updatedAt: Date.now() - 2160000000,
    },

    // ── 2 months ago ──
    {
        id: uuid(6),
        merchant: 'Walmart',
        date: daysAgo(50),
        totalAmount: 55.30,
        currency: 'USD',
        paymentSource: 'Credit',
        items: [
            { id: uuid(601), name: 'Bananas', quantity: 1.5, unit: 'lb', unitPrice: 0.55, total: 0.83, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(602), name: 'Whole Milk', quantity: 1, unit: 'ea', unitPrice: 3.89, total: 3.89, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(603), name: 'Chicken Breast', quantity: 2, unit: 'lb', unitPrice: 3.99, regularPrice: 4.29, total: 7.98, category: 'Groceries', tags: ['meat', 'sale'] },
            { id: uuid(604), name: 'Bread', quantity: 1, unit: 'ea', unitPrice: 2.79, total: 2.79, category: 'Groceries', tags: [] },
            { id: uuid(605), name: 'Eggs', quantity: 1, unit: 'dozen', unitPrice: 3.99, total: 3.99, category: 'Groceries', tags: [] },
            { id: uuid(606), name: 'Paper Towels', quantity: 1, unit: 'pack', unitPrice: 11.99, total: 11.99, category: 'Household', tags: [] },
            { id: uuid(607), name: 'Avocados', quantity: 3, unit: 'ea', unitPrice: 1.50, total: 4.50, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(608), name: 'Butter', quantity: 1, unit: 'ea', unitPrice: 3.99, total: 3.99, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(609), name: 'Rice', quantity: 1, unit: 'bag', unitPrice: 8.49, total: 8.49, category: 'Groceries', tags: ['grain'] },
            { id: uuid(610), name: 'Greek Yogurt', quantity: 4, unit: 'ea', unitPrice: 1.19, total: 4.76, category: 'Groceries', tags: ['dairy'] },
        ],
        tags: ['weekly-shop'],
        notes: 'Good deals on chicken today',
        createdAt: Date.now() - 4320000000,
        updatedAt: Date.now() - 4320000000,
    },
    {
        id: uuid(7),
        merchant: 'Costco',
        date: daysAgo(55),
        totalAmount: 134.22,
        currency: 'USD',
        paymentSource: 'Credit',
        items: [
            { id: uuid(701), name: 'Chicken Breast', quantity: 5, unit: 'lb', unitPrice: 3.19, total: 15.95, category: 'Groceries', tags: ['meat', 'bulk'] },
            { id: uuid(702), name: 'Rice', quantity: 1, unit: 'bag', unitPrice: 17.99, total: 17.99, category: 'Groceries', tags: ['grain', 'bulk'] },
            { id: uuid(703), name: 'Paper Towels', quantity: 1, unit: 'pack', unitPrice: 18.99, total: 18.99, category: 'Household', tags: ['bulk'] },
            { id: uuid(704), name: 'Eggs', quantity: 2, unit: 'dozen', unitPrice: 3.29, total: 6.58, category: 'Groceries', tags: ['bulk'] },
            { id: uuid(705), name: 'Whole Milk', quantity: 2, unit: 'ea', unitPrice: 3.19, total: 6.38, category: 'Groceries', tags: ['dairy', 'bulk'] },
            { id: uuid(706), name: 'Bananas', quantity: 3, unit: 'lb', unitPrice: 0.45, total: 1.35, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(707), name: 'Gasoline', quantity: 14, unit: 'ea', unitPrice: 3.29, total: 46.06, category: 'Transport', tags: [] },
            { id: uuid(708), name: 'Avocados', quantity: 6, unit: 'ea', unitPrice: 0.75, total: 4.50, category: 'Groceries', tags: ['fruit', 'bulk'] },
            { id: uuid(709), name: 'Butter', quantity: 2, unit: 'ea', unitPrice: 3.99, total: 7.98, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(710), name: 'Greek Yogurt', quantity: 3, unit: 'ea', unitPrice: 1.39, total: 4.17, category: 'Groceries', tags: ['dairy', 'bulk'] },
        ],
        tags: ['costco-run', 'bulk'],
        createdAt: Date.now() - 4752000000,
        updatedAt: Date.now() - 4752000000,
    },

    // ── 3 months ago ──
    {
        id: uuid(8),
        merchant: 'Walmart',
        date: daysAgo(80),
        totalAmount: 41.56,
        currency: 'USD',
        paymentSource: 'Cash',
        items: [
            { id: uuid(801), name: 'Bananas', quantity: 1, unit: 'lb', unitPrice: 0.52, total: 0.52, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(802), name: 'Whole Milk', quantity: 1, unit: 'ea', unitPrice: 3.79, total: 3.79, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(803), name: 'Bread', quantity: 1, unit: 'ea', unitPrice: 2.49, total: 2.49, category: 'Groceries', tags: [] },
            { id: uuid(804), name: 'Eggs', quantity: 1, unit: 'dozen', unitPrice: 3.49, total: 3.49, category: 'Groceries', tags: [] },
            { id: uuid(805), name: 'Avocados', quantity: 3, unit: 'ea', unitPrice: 1.00, total: 3.00, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(806), name: 'Orange Juice', quantity: 1, unit: 'ea', unitPrice: 3.99, total: 3.99, category: 'Groceries', tags: ['beverage'] },
            { id: uuid(807), name: 'Butter', quantity: 1, unit: 'ea', unitPrice: 3.49, total: 3.49, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(808), name: 'Greek Yogurt', quantity: 2, unit: 'ea', unitPrice: 1.09, total: 2.18, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(809), name: 'Chicken Breast', quantity: 2, unit: 'lb', unitPrice: 3.79, total: 7.58, category: 'Groceries', tags: ['meat'] },
            { id: uuid(810), name: 'Rice', quantity: 1, unit: 'bag', unitPrice: 7.99, total: 7.99, category: 'Groceries', tags: ['grain'] },
        ],
        tags: [],
        createdAt: Date.now() - 6912000000,
        updatedAt: Date.now() - 6912000000,
    },

    // ── Dining / Entertainment ──
    {
        id: uuid(9),
        merchant: 'Chipotle',
        date: daysAgo(3),
        totalAmount: 14.75,
        currency: 'USD',
        paymentSource: 'Credit',
        items: [
            { id: uuid(901), name: 'Burrito Bowl', quantity: 1, unit: 'ea', unitPrice: 10.75, total: 10.75, category: 'Dining', tags: [] },
            { id: uuid(902), name: 'Chips & Guac', quantity: 1, unit: 'ea', unitPrice: 4.00, total: 4.00, category: 'Dining', tags: [] },
        ],
        tags: ['lunch'],
        createdAt: Date.now() - 259200000,
        updatedAt: Date.now() - 259200000,
    },
    {
        id: uuid(10),
        merchant: 'Target',
        date: daysAgo(12),
        totalAmount: 38.96,
        currency: 'USD',
        paymentSource: 'Debit',
        items: [
            { id: uuid(1001), name: 'Bananas', quantity: 1, unit: 'lb', unitPrice: 0.69, total: 0.69, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(1002), name: 'Whole Milk', quantity: 1, unit: 'ea', unitPrice: 4.29, total: 4.29, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(1003), name: 'Dish Soap', quantity: 1, unit: 'ea', unitPrice: 3.49, total: 3.49, category: 'Household', tags: [] },
            { id: uuid(1004), name: 'Eggs', quantity: 1, unit: 'dozen', unitPrice: 4.99, total: 4.99, category: 'Groceries', tags: [] },
            { id: uuid(1005), name: 'Avocados', quantity: 2, unit: 'ea', unitPrice: 1.49, total: 2.98, category: 'Groceries', tags: ['fruit'] },
            { id: uuid(1006), name: 'Chicken Breast', quantity: 1.5, unit: 'lb', unitPrice: 4.99, total: 7.49, category: 'Groceries', tags: ['meat'] },
            { id: uuid(1007), name: 'Greek Yogurt', quantity: 3, unit: 'ea', unitPrice: 1.59, total: 4.77, category: 'Groceries', tags: ['dairy'] },
            { id: uuid(1008), name: 'Bread', quantity: 1, unit: 'ea', unitPrice: 3.29, total: 3.29, category: 'Groceries', tags: [] },
            { id: uuid(1009), name: 'Butter', quantity: 1, unit: 'ea', unitPrice: 4.49, total: 4.49, category: 'Groceries', tags: ['dairy'] },
        ],
        tags: [],
        createdAt: Date.now() - 1036800000,
        updatedAt: Date.now() - 1036800000,
    },
];
