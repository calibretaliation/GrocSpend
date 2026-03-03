import React, { useState, useEffect } from 'react';
import { ArrowLeft, DollarSign, Save, CheckCircle2 } from 'lucide-react';
import { CATEGORIES } from '../constants';
import { useBudget } from '../contexts/BudgetContext';
import type { BudgetConfig } from '../types';

interface SettingsProps {
    onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const { budget, setBudget } = useBudget();
    const [monthlyBudget, setMonthlyBudget] = useState('');
    const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>({});
    const [showCategoryBudgets, setShowCategoryBudgets] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setMonthlyBudget(budget.monthlyBudget > 0 ? String(budget.monthlyBudget) : '');
        const cats: Record<string, string> = {};
        CATEGORIES.forEach(cat => {
            const val = budget.categoryBudgets[cat];
            cats[cat] = val && val > 0 ? String(val) : '';
        });
        setCategoryBudgets(cats);
        setShowCategoryBudgets(Object.values(budget.categoryBudgets).some(v => v > 0));
    }, [budget]);

    const handleSave = () => {
        const config: BudgetConfig = {
            monthlyBudget: Math.max(0, Number(monthlyBudget) || 0),
            categoryBudgets: {},
        };
        CATEGORIES.forEach(cat => {
            const val = Number(categoryBudgets[cat]);
            if (val > 0) {
                config.categoryBudgets[cat] = val;
            }
        });
        setBudget(config);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleCategoryChange = (cat: string, value: string) => {
        setCategoryBudgets(prev => ({ ...prev, [cat]: value }));
    };

    const handleClearBudget = () => {
        setMonthlyBudget('');
        setCategoryBudgets({});
        setBudget({ monthlyBudget: 0, categoryBudgets: {} });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white p-4 border-b border-slate-200 shadow-sm sticky top-0 z-10">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 mb-3 transition-colors"
                >
                    <ArrowLeft size={16} /> Back
                </button>
                <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
                <p className="text-xs text-slate-500 mt-1">Manage your budget goals and preferences</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-6">
                {/* Monthly Budget */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                        <DollarSign size={14} className="text-primary" />
                        Monthly Budget
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                        Set a monthly spending target. A progress ring will appear on your dashboard.
                    </p>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">$</span>
                        <input
                            type="number"
                            inputMode="decimal"
                            placeholder="e.g. 500"
                            value={monthlyBudget}
                            onChange={e => setMonthlyBudget(e.target.value)}
                            className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary text-lg font-semibold text-slate-800"
                            min="0"
                            step="10"
                        />
                    </div>
                </div>

                {/* Category Budgets */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold text-slate-700">Category Budgets</h3>
                        <button
                            onClick={() => setShowCategoryBudgets(prev => !prev)}
                            className="text-xs text-primary hover:text-sky-700 font-medium"
                        >
                            {showCategoryBudgets ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 mb-4">
                        Optional per-category limits. Leave blank to skip.
                    </p>

                    {showCategoryBudgets && (
                        <div className="space-y-3">
                            {CATEGORIES.map(cat => (
                                <div key={cat} className="flex items-center gap-3">
                                    <label className="text-sm text-slate-600 w-28 shrink-0">{cat}</label>
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            placeholder="—"
                                            value={categoryBudgets[cat] || ''}
                                            onChange={e => handleCategoryChange(cat, e.target.value)}
                                            className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary text-sm text-slate-700"
                                            min="0"
                                            step="5"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={handleSave}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-sky-600 transition-colors shadow-sm"
                    >
                        {saved ? (
                            <>
                                <CheckCircle2 size={16} /> Saved!
                            </>
                        ) : (
                            <>
                                <Save size={16} /> Save Budget
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleClearBudget}
                        className="px-4 py-3 border border-slate-200 text-slate-500 rounded-xl text-sm hover:border-slate-300 hover:text-slate-700 transition-colors"
                    >
                        Clear
                    </button>
                </div>
            </div>
        </div>
    );
};
