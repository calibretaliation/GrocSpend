import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import {
    ChevronLeft, ChevronRight, CalendarDays, ChevronDown, RotateCcw,
    Receipt as ReceiptIcon, ShoppingCart, TrendingUp,
} from 'lucide-react';
import { CATEGORIES } from '../constants';
import { formatDateInputValue, formatReceiptDisplayDate, isValidDate, parseReceiptDate } from '../utils/date';
import { useReceipts } from '../contexts/ReceiptsContext';
import { useBudget } from '../contexts/BudgetContext';

const COLORS = ['#0ea5e9', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export const Dashboard: React.FC<{ onViewDetails: (id: string) => void }> = ({ onViewDetails }) => {
    const { receipts, loading, error } = useReceipts();
    const { budget } = useBudget();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    // Month navigation state
    const now = new Date();
    const [viewYear, setViewYear] = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth());
    const [mode, setMode] = useState<'month' | 'custom'>('month');
    const [customRange, setCustomRange] = useState<DateRange | undefined>();
    const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
    const rangePickerRef = useRef<HTMLDivElement | null>(null);

    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

    // Click-outside for range picker
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (rangePickerRef.current && !rangePickerRef.current.contains(e.target as Node)) {
                setIsRangePickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const goToPrevMonth = () => {
        setViewMonth(prev => {
            if (prev === 0) { setViewYear(y => y - 1); return 11; }
            return prev - 1;
        });
        setSelectedCategory(null);
        setSelectedDay(null);
    };
    const goToNextMonth = () => {
        if (isCurrentMonth) return;
        setViewMonth(prev => {
            if (prev === 11) { setViewYear(y => y + 1); return 0; }
            return prev + 1;
        });
        setSelectedCategory(null);
        setSelectedDay(null);
    };
    const goToToday = () => {
        setViewYear(now.getFullYear());
        setViewMonth(now.getMonth());
        setMode('month');
        setSelectedCategory(null);
        setSelectedDay(null);
    };

    // Selected period range
    const periodRange = useMemo(() => {
        if (mode === 'custom' && customRange?.from) {
            const from = new Date(customRange.from);
            from.setHours(0, 0, 0, 0);
            const to = customRange.to ? new Date(customRange.to) : new Date(customRange.from);
            to.setHours(23, 59, 59, 999);
            return { start: from, end: to };
        }
        const start = new Date(viewYear, viewMonth, 1, 0, 0, 0, 0);
        const endDay = isCurrentMonth ? now.getDate() : new Date(viewYear, viewMonth + 1, 0).getDate();
        const end = new Date(viewYear, viewMonth, endDay, 23, 59, 59, 999);
        return { start, end };
    }, [viewYear, viewMonth, mode, customRange, isCurrentMonth]);

    const periodLabel = useMemo(() => {
        if (mode === 'custom' && customRange?.from) {
            const fromStr = formatDateInputValue(customRange.from);
            const toStr = customRange.to ? formatDateInputValue(customRange.to) : fromStr;
            return `${formatReceiptDisplayDate(fromStr)} – ${formatReceiptDisplayDate(toStr)}`;
        }
        return `${MONTH_NAMES[viewMonth]} ${viewYear}`;
    }, [mode, customRange, viewMonth, viewYear]);

    // Receipts in selected period
    const periodReceipts = useMemo(() => {
        const { start, end } = periodRange;
        return receipts.filter(r => {
            const d = parseReceiptDate(r.date);
            return isValidDate(d) && d >= start && d <= end;
        });
    }, [receipts, periodRange]);

    // Last 7 days bar data (relative to end of period)
    const recentRange = useMemo(() => {
        const end = new Date(periodRange.end);
        end.setHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        return { start, end };
    }, [periodRange]);

    const recentReceipts = useMemo(() => {
        const { start, end } = recentRange;
        return receipts.filter(r => {
            const d = parseReceiptDate(r.date);
            return isValidDate(d) && d >= start && d <= end;
        });
    }, [receipts, recentRange]);

    // Pie chart: category breakdown for selected period
    const pieData = useMemo(() => {
        const map = new Map<string, number>();
        periodReceipts.forEach(r => {
            r.items.forEach(item => {
                const cat = item.category || 'Other';
                map.set(cat, (map.get(cat) || 0) + item.total);
            });
            if (r.items.length === 0 && r.totalAmount > 0) {
                const cat = 'Uncategorized';
                map.set(cat, (map.get(cat) || 0) + r.totalAmount);
            }
        });
        return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    }, [periodReceipts]);

    // Daily bar chart for last 7 days of the period
    const barData = useMemo(() => {
        const data: Array<{ name: string; amount: number; date: string }> = [];
        const cursor = new Date(recentRange.start);
        const { end } = recentRange;
        while (cursor <= end) {
            const dateStr = formatDateInputValue(cursor);
            const displayDate = `${cursor.getMonth() + 1}/${cursor.getDate()}`;
            const dayTotal = recentReceipts
                .filter(r => r.date === dateStr)
                .reduce((sum, r) => sum + r.totalAmount, 0);
            data.push({ name: displayDate, amount: dayTotal, date: dateStr });
            cursor.setDate(cursor.getDate() + 1);
        }
        return data;
    }, [recentReceipts, recentRange]);

    // Monthly comparison: last 6 months
    const monthlyBarData = useMemo(() => {
        const data: Array<{ name: string; amount: number; month: number; year: number; isCurrent: boolean }> = [];
        for (let i = 5; i >= 0; i--) {
            let m = viewMonth - i;
            let y = viewYear;
            while (m < 0) { m += 12; y--; }
            const start = new Date(y, m, 1, 0, 0, 0, 0);
            const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
            const total = receipts
                .filter(r => {
                    const d = parseReceiptDate(r.date);
                    return isValidDate(d) && d >= start && d <= end;
                })
                .reduce((sum, r) => sum + r.totalAmount, 0);
            data.push({
                name: `${MONTH_NAMES[m].slice(0, 3)}`,
                amount: total,
                month: m,
                year: y,
                isCurrent: m === viewMonth && y === viewYear,
            });
        }
        return data;
    }, [receipts, viewMonth, viewYear]);

    // Summary stats
    const totalSpent = periodReceipts.reduce((sum, r) => sum + r.totalAmount, 0);
    const receiptCount = periodReceipts.length;
    const itemCount = periodReceipts.reduce((sum, r) => sum + r.items.length, 0);
    const avgPerReceipt = receiptCount > 0 ? totalSpent / receiptCount : 0;

    // Filtered receipts for the transaction list
    const filteredReceipts = useMemo(() => {
        return receipts.filter(receipt => {
            const receiptDate = parseReceiptDate(receipt.date);
            if (!isValidDate(receiptDate)) return false;

            const inPeriodRange = receiptDate >= periodRange.start && receiptDate <= periodRange.end;
            const inRecentRange = receiptDate >= recentRange.start && receiptDate <= recentRange.end;

            const matchesCategory = selectedCategory
                ? receipt.items.some(item => (item.category || 'Other') === selectedCategory)
                : true;
            const matchesDay = selectedDay ? receipt.date === selectedDay : true;

            const matchesBaseRange = selectedDay
                ? inRecentRange
                : selectedCategory
                    ? inPeriodRange
                    : inRecentRange;

            return matchesBaseRange && matchesCategory && matchesDay;
        });
    }, [receipts, selectedCategory, selectedDay, periodRange, recentRange]);

    const handleCategorySelect = (category: string) => {
        setSelectedCategory(prev => (prev === category ? null : category));
    };

    const handleDaySelect = (date: string) => {
        setSelectedDay(prev => (prev === date ? null : date));
    };

    const handleClearFilters = () => {
        setSelectedCategory(null);
        setSelectedDay(null);
    };

    const customRangeSummary = useMemo(() => {
        if (!customRange?.from && !customRange?.to) return 'Select range';
        if (customRange?.from && !customRange?.to) return formatDateInputValue(customRange.from);
        if (customRange?.from && customRange?.to)
            return `${formatDateInputValue(customRange.from)} – ${formatDateInputValue(customRange.to)}`;
        return 'Select range';
    }, [customRange]);

    return (
        <div className="flex flex-col h-full">
            {/* Upper: Charts & Controls */}
            <div className="bg-white p-4 pb-2 border-b border-slate-200">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                        <button onClick={goToPrevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                            <ChevronLeft size={18} />
                        </button>
                        <h2 className="text-lg font-bold text-slate-800 min-w-0">{periodLabel}</h2>
                        <button
                            onClick={goToNextMonth}
                            disabled={isCurrentMonth && mode === 'month'}
                            className={`p-1.5 rounded-lg transition-colors ${isCurrentMonth && mode === 'month'
                                ? 'text-slate-200 cursor-not-allowed'
                                : 'hover:bg-slate-100 text-slate-500'
                                }`}
                        >
                            <ChevronRight size={18} />
                        </button>
                        {!isCurrentMonth && mode === 'month' && (
                            <button
                                onClick={goToToday}
                                className="ml-1 px-2 py-1 text-[10px] font-semibold text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
                            >
                                Today
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => { setMode(prev => prev === 'month' ? 'custom' : 'month'); }}
                        className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${mode === 'custom'
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        <CalendarDays size={12} /> Custom
                    </button>
                </div>

                {/* Custom Range Picker */}
                {mode === 'custom' && (
                    <div className="mb-3" ref={rangePickerRef}>
                        <button
                            type="button"
                            onClick={() => setIsRangePickerOpen(prev => !prev)}
                            className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <span>{customRangeSummary}</span>
                            <ChevronDown size={14} className={`transition-transform ${isRangePickerOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isRangePickerOpen && (
                            <div className="relative">
                                <div className="absolute z-20 mt-2 w-full sm:w-auto border border-slate-200 rounded-lg bg-white shadow-xl p-3">
                                    <DayPicker
                                        mode="range"
                                        selected={customRange}
                                        onSelect={setCustomRange}
                                        numberOfMonths={1}
                                        defaultMonth={customRange?.from}
                                        className="text-sm"
                                    />
                                    <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                                        <button
                                            type="button"
                                            onClick={() => setCustomRange(undefined)}
                                            className="px-2 py-1 rounded hover:text-slate-700"
                                        >
                                            Clear
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsRangePickerOpen(false)}
                                            className="px-3 py-1 rounded bg-slate-800 text-white hover:bg-slate-700"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Hero Total + Budget Ring */}
                {budget.monthlyBudget > 0 && mode === 'month' ? (() => {
                    const pct = Math.min((totalSpent / budget.monthlyBudget) * 100, 150);
                    const displayPct = Math.round(pct);
                    const remaining = budget.monthlyBudget - totalSpent;
                    const ringColor = pct >= 90 ? '#ef4444' : pct >= 75 ? '#f59e0b' : '#10b981';
                    const circumference = 2 * Math.PI * 40;
                    const dashOffset = circumference - (Math.min(pct, 100) / 100) * circumference;
                    return (
                        <div className="flex items-center gap-4 mb-3">
                            <div className="relative w-20 h-20 shrink-0">
                                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                                    <circle
                                        cx="50" cy="50" r="40" fill="none"
                                        stroke={ringColor}
                                        strokeWidth="8"
                                        strokeLinecap="round"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={dashOffset}
                                        className="transition-all duration-700 ease-out"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-bold" style={{ color: ringColor }}>{displayPct}%</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-3xl font-extrabold text-slate-900 tracking-tight">${totalSpent.toFixed(2)}</div>
                                <p className={`text-xs font-medium mt-0.5 ${remaining >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {remaining >= 0 ? `$${remaining.toFixed(2)} remaining` : `$${Math.abs(remaining).toFixed(2)} over budget`}
                                </p>
                                <p className="text-[10px] text-slate-400">of ${budget.monthlyBudget.toFixed(2)} budget</p>
                            </div>
                        </div>
                    );
                })() : (
                    <div className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
                        ${totalSpent.toFixed(2)}
                    </div>
                )}

                {/* Summary Stats */}
                <div className="flex items-center gap-4 text-[11px] text-slate-500 mb-3">
                    <span className="flex items-center gap-1">
                        <ReceiptIcon size={11} /> {receiptCount} receipt{receiptCount !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                        <ShoppingCart size={11} /> {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                        <TrendingUp size={11} /> ${avgPerReceipt.toFixed(2)}/receipt
                    </span>
                </div>

                {/* Active Filters */}
                {(selectedCategory || selectedDay) && (
                    <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                        <span className="font-semibold uppercase tracking-tight">Active Filters:</span>
                        {selectedCategory && (
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">Category: {selectedCategory}</span>
                        )}
                        {selectedDay && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Day: {formatReceiptDisplayDate(selectedDay)}</span>
                        )}
                        <button onClick={handleClearFilters} className="ml-auto text-sky-600 hover:text-sky-700">Clear</button>
                    </div>
                )}

                {/* Charts Row */}
                <div className="flex flex-row h-48">
                    {/* Pie Chart */}
                    <div className="flex-1 relative">
                        <h3 className="text-xs text-slate-500 font-semibold absolute top-0 left-0">By Category</h3>
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading…</div>
                        ) : pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={60}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={COLORS[index % COLORS.length]}
                                                fillOpacity={selectedCategory && selectedCategory !== entry.name ? 0.4 : 1}
                                                stroke={selectedCategory === entry.name ? '#0f172a' : undefined}
                                                strokeWidth={selectedCategory === entry.name ? 2 : 1}
                                                cursor="pointer"
                                                onClick={() => handleCategorySelect(entry.name)}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-xs text-slate-400">No data</div>
                        )}
                    </div>

                    {/* Daily Bar Chart */}
                    <div className="flex-1 relative border-l border-slate-100 pl-2">
                        <h3 className="text-xs text-slate-500 font-semibold absolute top-0 left-2">Daily · Last 7 Days</h3>
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading…</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData}>
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        formatter={(value: number) => `$${value.toFixed(2)}`}
                                        labelFormatter={(_, payload) => {
                                            const target = Array.isArray(payload) && payload.length > 0 ? payload[0].payload : null;
                                            return target ? formatReceiptDisplayDate(target.date) : '';
                                        }}
                                    />
                                    <Bar
                                        dataKey="amount"
                                        fill="#0ea5e9"
                                        radius={[4, 4, 0, 0]}
                                        cursor="pointer"
                                        onClick={(_, index) => {
                                            const target = barData[index];
                                            if (target) handleDaySelect(target.date);
                                        }}
                                    >
                                        {barData.map((entry, index) => (
                                            <Cell
                                                key={`bar-${index}`}
                                                fill={selectedDay === entry.date ? '#0b81c5' : '#0ea5e9'}
                                                fillOpacity={selectedDay && selectedDay !== entry.date ? 0.5 : 1}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Monthly Comparison Chart */}
            {mode === 'month' && (
                <div className="bg-white border-b border-slate-200 px-4 py-3">
                    <h3 className="text-xs text-slate-500 font-semibold mb-2">Monthly Comparison</h3>
                    <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyBarData} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={45} />
                                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                    {monthlyBarData.map((entry, index) => (
                                        <Cell
                                            key={`mbar-${index}`}
                                            fill={entry.isCurrent ? '#0ea5e9' : '#cbd5e1'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Category Budget Bars */}
            {mode === 'month' && Object.keys(budget.categoryBudgets).length > 0 && (
                <div className="bg-white border-b border-slate-200 px-4 py-3">
                    <h3 className="text-xs text-slate-500 font-semibold mb-2">Category Budget</h3>
                    <div className="space-y-2">
                        {Object.entries(budget.categoryBudgets)
                            .filter(([, limit]) => limit > 0)
                            .map(([cat, limit]) => {
                                const spent = pieData.find(d => d.name === cat)?.value ?? 0;
                                const pct = Math.min((spent / limit) * 100, 100);
                                const barColor = pct >= 90 ? '#ef4444' : pct >= 75 ? '#f59e0b' : '#0ea5e9';
                                return (
                                    <div key={cat}>
                                        <div className="flex items-center justify-between text-[11px] mb-1">
                                            <span className="text-slate-600 font-medium">{cat}</span>
                                            <span className="text-slate-400">${spent.toFixed(2)} / ${limit.toFixed(2)}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%`, backgroundColor: barColor }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Lower: Transaction List */}
            <div className="flex-1 bg-slate-50 overflow-hidden flex flex-col">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                    Recent Transactions
                </h3>
                <div className="overflow-y-auto flex-1 px-4 pb-20 no-scrollbar space-y-3">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">
                            {error}
                        </div>
                    )}
                    {loading ? (
                        <div className="text-center text-slate-400 py-10">Loading receipts…</div>
                    ) : filteredReceipts.length === 0 ? (
                        <div className="text-center text-slate-400 py-10">
                            {selectedCategory || selectedDay
                                ? 'No receipts match the selected filters.'
                                : `No transactions in ${periodLabel}.`}
                        </div>
                    ) : (
                        filteredReceipts
                            .sort((a, b) => b.createdAt - a.createdAt)
                            .map(receipt => (
                                <div
                                    key={receipt.id}
                                    onClick={() => onViewDetails(receipt.id)}
                                    className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 flex justify-between items-center active:bg-slate-50"
                                >
                                    <div className="flex-1">
                                        <p className="font-semibold text-slate-800">{receipt.merchant}</p>
                                        <p className="text-xs text-slate-500">
                                            {formatReceiptDisplayDate(receipt.date)} • {receipt.paymentSource}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-slate-800">${receipt.totalAmount.toFixed(2)}</p>
                                        <p className="text-xs text-slate-400">{receipt.items.length} items</p>
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            </div>
        </div>
    );
};