import { describe, expect, it } from 'vitest';
import { formatDateInputValue, parseReceiptDate, isValidDate, formatReceiptDisplayDate } from '../../utils/date';

describe('date utilities', () => {
    it('formats dates as YYYY-MM-DD in local timezone', () => {
        const input = new Date('2024-03-15T18:30:00Z');
        const result = formatDateInputValue(input);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const parsed = parseReceiptDate(result);
        expect(parsed.getUTCFullYear()).toBe(2024);
        expect(parsed.getUTCMonth()).toBe(2);
        expect(parsed.getUTCDate()).toBe(15);
    });

    it('parses valid receipt dates', () => {
        const parsed = parseReceiptDate('2023-12-05');
        expect(parsed.getFullYear()).toBe(2023);
        expect(parsed.getMonth()).toBe(11);
        expect(parsed.getDate()).toBe(5);
        expect(isValidDate(parsed)).toBe(true);
    });

    it('handles invalid date inputs gracefully', () => {
        const parsed = parseReceiptDate('');
        expect(isValidDate(parsed)).toBe(false);
        expect(formatReceiptDisplayDate('invalid-date')).toBe('invalid-date');
    });

    it('formats valid receipt display date', () => {
        const formatted = formatReceiptDisplayDate('2024-01-10', 'en-US');
        expect(formatted).toBe('1/10/2024');
    });
});
