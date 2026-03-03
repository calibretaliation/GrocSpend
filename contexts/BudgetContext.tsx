import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { BudgetConfig } from '../types';

const STORAGE_KEY = 'smart_spend_budget';

const DEFAULT_BUDGET: BudgetConfig = {
    monthlyBudget: 0,
    categoryBudgets: {},
};

interface BudgetContextValue {
    budget: BudgetConfig;
    setBudget: (config: BudgetConfig) => void;
}

const BudgetContext = createContext<BudgetContextValue | undefined>(undefined);

const readStoredBudget = (): BudgetConfig => {
    if (typeof window === 'undefined') return DEFAULT_BUDGET;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BUDGET;
    try {
        const parsed = JSON.parse(raw) as BudgetConfig;
        if (typeof parsed.monthlyBudget === 'number') {
            return {
                monthlyBudget: parsed.monthlyBudget,
                categoryBudgets: parsed.categoryBudgets ?? {},
            };
        }
    } catch {
        console.warn('Failed to parse stored budget');
    }
    return DEFAULT_BUDGET;
};

export const BudgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [budget, setBudgetState] = useState<BudgetConfig>(DEFAULT_BUDGET);

    useEffect(() => {
        setBudgetState(readStoredBudget());
    }, []);

    const setBudget = useCallback((config: BudgetConfig) => {
        setBudgetState(config);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        }
    }, []);

    const value = useMemo(() => ({ budget, setBudget }), [budget, setBudget]);

    return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
};

export const useBudget = (): BudgetContextValue => {
    const context = useContext(BudgetContext);
    if (!context) {
        throw new Error('useBudget must be used within BudgetProvider');
    }
    return context;
};
