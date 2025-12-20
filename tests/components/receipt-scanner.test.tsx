import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Receipt, ReceiptPreset } from '../../types';
import { ReceiptScanner } from '../../components/ReceiptScanner';

const authorizedFetchMock = vi.fn();
const quickAddMock = vi.fn();
let presetsStore: ReceiptPreset[] = [];

const noop = () => undefined;

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        token: 'token',
        authorizedFetch: authorizedFetchMock,
        loading: false,
    })
}));

vi.mock('../../contexts/ReceiptsContext', () => ({
    useReceipts: () => ({
        receipts: [],
        loading: false,
        error: null,
        refresh: vi.fn(),
        upsert: vi.fn(),
        remove: vi.fn(),
        quickAdd: (...args: unknown[]) => quickAddMock(...args),
        saveStates: {},
        retrySave: vi.fn(),
    })
}));

vi.mock('../../contexts/ReceiptPresetsContext', () => ({
    useReceiptPresets: () => ({
        presets: presetsStore,
        addPreset: vi.fn(),
        removePreset: vi.fn(),
        updatePreset: vi.fn(),
    })
}));

vi.mock('../../contexts/ReceiptImagesContext', () => ({
    useReceiptImages: () => ({
        setImage: noop,
        removeImage: noop,
        getImage: () => null,
    })
}));

vi.mock('../../services/geminiService', () => ({
    analyzeReceiptImage: vi.fn(),
}));

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

describe('ReceiptScanner presets', () => {
    beforeEach(() => {
        presetsStore = [
            {
                id: 'preset-1',
                name: 'Lunch Run',
                merchant: 'Corner Shop',
                totalAmount: 12.5,
                currency: 'USD',
                paymentSource: 'Credit',
                items: [],
                tags: [],
            }
        ];
        quickAddMock.mockReset();
    });

    afterEach(() => {
        quickAddMock.mockReset();
    });

    it('shows and clears the optimistic save toast when using presets', async () => {
        const saveDeferred = deferred<Receipt>();
        quickAddMock.mockImplementation(() => saveDeferred.promise);
        const onSaveSuccess = vi.fn();
        render(<ReceiptScanner onSaveSuccess={onSaveSuccess} />);

        const user = userEvent.setup();
        await act(async () => {
            await user.click(screen.getByText('Lunch Run'));
        });

        expect(quickAddMock).toHaveBeenCalledTimes(1);
        expect(onSaveSuccess).toHaveBeenCalledTimes(1);

        const persisted: Receipt = {
            id: 'server-1',
            merchant: 'Corner Shop',
            date: '2024-01-01',
            totalAmount: 12.5,
            currency: 'USD',
            paymentSource: 'Credit',
            items: [],
            tags: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        await act(async () => {
            saveDeferred.resolve(persisted);
            await saveDeferred.promise;
        });
    });
});
