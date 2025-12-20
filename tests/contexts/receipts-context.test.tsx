import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Receipt } from '../../types';
import { ReceiptsProvider, useReceipts } from '../../contexts/ReceiptsContext';

const authorizedFetchMock = vi.fn();
const getReceiptsMock = vi.fn();
const saveReceiptMock = vi.fn();
const deleteReceiptMock = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        token: 'test-token',
        authorizedFetch: authorizedFetchMock,
        loading: false,
    })
}));

vi.mock('../../services/storageService', () => ({
    getReceipts: (...args: unknown[]) => getReceiptsMock(...args),
    saveReceipt: (...args: unknown[]) => saveReceiptMock(...args),
    deleteReceipt: (...args: unknown[]) => deleteReceiptMock(...args),
}));

const createReceipt = (overrides: Partial<Receipt> = {}): Receipt => ({
    id: 'temp-id',
    merchant: 'Corner Shop',
    date: '2024-01-01',
    totalAmount: 19.99,
    currency: 'USD',
    paymentSource: 'Credit',
    items: [],
    tags: [],
    createdAt: 1704067200000,
    updatedAt: 1704067200000,
    ...overrides,
});

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

describe('ReceiptsContext', () => {
    beforeEach(() => {
        authorizedFetchMock.mockReset();
        getReceiptsMock.mockReset();
        saveReceiptMock.mockReset();
        deleteReceiptMock.mockReset();
        getReceiptsMock.mockResolvedValue([]);
    });

    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <ReceiptsProvider>{children}</ReceiptsProvider>
    );

    it('loads receipts on mount', async () => {
        const existing = createReceipt({ id: 'existing' });
        getReceiptsMock.mockResolvedValueOnce([existing]);
        const { result } = renderHook(() => useReceipts(), { wrapper });
        await waitFor(() => expect(result.current.receipts).toHaveLength(1));
        expect(result.current.receipts[0].id).toBe('existing');
        expect(getReceiptsMock).toHaveBeenCalledTimes(1);
    });

    it('handles quickAdd success path', async () => {
        const optimistic = createReceipt();
        const persisted = { ...optimistic, updatedAt: optimistic.updatedAt + 10 };
        const saveDeferred = deferred<Receipt>();
        saveReceiptMock.mockReturnValueOnce(saveDeferred.promise);

        const { result } = renderHook(() => useReceipts(), { wrapper });
        await waitFor(() => expect(result.current.loading).toBe(false));

        let quickAddPromise: Promise<Receipt> | undefined;
        await act(async () => {
            quickAddPromise = result.current.quickAdd(optimistic);
        });

        await waitFor(() => expect(result.current.saveStates[optimistic.id]).toBe('pending'));

        if (!quickAddPromise) {
            throw new Error('quickAdd did not return a promise');
        }

        act(() => {
            saveDeferred.resolve(persisted);
        });

        await act(async () => {
            await quickAddPromise;
        });

        await waitFor(() => expect(result.current.saveStates[optimistic.id]).toBeUndefined());
        expect(result.current.receipts[0].id).toBe(optimistic.id);
        expect(saveReceiptMock).toHaveBeenCalledWith(optimistic, authorizedFetchMock);
    });

    it('marks failed quickAdd attempts and preserves draft', async () => {
        const optimistic = createReceipt();
        saveReceiptMock.mockRejectedValueOnce(new Error('boom'));

        const { result } = renderHook(() => useReceipts(), { wrapper });
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await expect(result.current.quickAdd(optimistic)).rejects.toThrow();
        });

        expect(result.current.receipts).toHaveLength(0);
        await waitFor(() => expect(result.current.saveStates[optimistic.id]).toBe('failed'));
    });

    it('retries failed saves using stored draft', async () => {
        const optimistic = createReceipt();
        const persisted = { ...optimistic, updatedAt: optimistic.updatedAt + 5 };
        saveReceiptMock
            .mockRejectedValueOnce(new Error('temporary'))
            .mockResolvedValueOnce(persisted);

        const { result } = renderHook(() => useReceipts(), { wrapper });
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await expect(result.current.quickAdd(optimistic)).rejects.toThrow();
        });

        await act(async () => {
            await result.current.retrySave(optimistic.id);
        });

        await waitFor(() => expect(result.current.saveStates[optimistic.id]).toBeUndefined());
        expect(result.current.receipts[0].id).toBe(optimistic.id);
        expect(saveReceiptMock).toHaveBeenCalledTimes(2);
    });

    it('removes receipts and clears state caches', async () => {
        const existing = createReceipt({ id: 'remove-me' });
        getReceiptsMock.mockResolvedValueOnce([existing]);
        deleteReceiptMock.mockResolvedValueOnce(undefined);

        const { result } = renderHook(() => useReceipts(), { wrapper });
        await waitFor(() => expect(result.current.receipts).toHaveLength(1));

        await act(async () => {
            await result.current.remove(existing.id);
        });

        expect(result.current.receipts).toHaveLength(0);
        expect(deleteReceiptMock).toHaveBeenCalledWith(existing.id, authorizedFetchMock);
    });
});
