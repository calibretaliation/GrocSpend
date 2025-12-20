import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { CATEGORIES } from '../constants';
import { formatDateInputValue, formatReceiptDisplayDate, isValidDate, parseReceiptDate } from '../utils/date';
import { useReceipts } from '../contexts/ReceiptsContext';

const COLORS = ['#0ea5e9', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

export const Dashboard: React.FC<{ onViewDetails: (id: string) => void }> = ({ onViewDetails }) => {
    const { receipts, loading, error } = useReceipts();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    const recentRange = useMemo(() => {
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        return { start, end };
    }, []);

    const rangeLabel = useMemo(() => 'Last 7 Days', []);

    const recentReceipts = useMemo(() => {
        const { start, end } = recentRange;
        return receipts.filter(r => {
            const d = parseReceiptDate(r.date);
            return isValidDate(d) && d >= start && d <= end;
        });
    }, [receipts, recentRange]);

  // Pie Chart Data: Expenses by Category
    const pieData = useMemo(() => {
        const map = new Map<string, number>();
        recentReceipts.forEach(r => {
        r.items.forEach(item => {
            const cat = item.category || 'Other';
            map.set(cat, (map.get(cat) || 0) + item.total);
        });
        // If items are empty but total exists (manual entry fallback)
        if (r.items.length === 0 && r.totalAmount > 0) {
             const cat = 'Uncategorized';
             map.set(cat, (map.get(cat) || 0) + r.totalAmount);
        }
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    }, [recentReceipts]);

  // Bar Chart Data: Daily Spending (Last 7 days)
  const barData = useMemo(() => {
         const data = [] as Array<{ name: string; amount: number; date: string }>;
         const cursor = new Date(recentRange.start);
         const { end } = recentRange;
         while (cursor <= end) {
                const dateStr = formatDateInputValue(cursor);
                const displayDate = `${cursor.getMonth() + 1}/${cursor.getDate()}`;
                const dayTotal = recentReceipts
                        .filter(r => r.date === dateStr)
                        .reduce((sum, r) => sum + r.totalAmount, 0);
                data.push({
                        name: displayDate,
                        amount: dayTotal,
                        date: dateStr
                });
                cursor.setDate(cursor.getDate() + 1);
         }
         return data;
    }, [recentReceipts, recentRange]);

    const filteredReceipts = useMemo(() => {
        return recentReceipts.filter(receipt => {
            const matchesCategory = selectedCategory
                ? receipt.items.some(item => (item.category || 'Other') === selectedCategory)
                : true;
            const matchesDay = selectedDay ? receipt.date === selectedDay : true;
            return matchesCategory && matchesDay;
        });
    }, [recentReceipts, selectedCategory, selectedDay]);

    const totalSpentInRange = recentReceipts.reduce((sum, r) => sum + r.totalAmount, 0);

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

  return (
    <div className="flex flex-col h-full">
        {/* Upper Fold (Charts) - Fixed Height approx 40% */}
        <div className="bg-white p-4 pb-2 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-2">{rangeLabel}: ${totalSpentInRange.toFixed(2)}</h2>
            {(selectedCategory || selectedDay) && (
                <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                    <span className="font-semibold uppercase tracking-tight">Active Filters:</span>
                    {selectedCategory && (
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">Category: {selectedCategory}</span>
                    )}
                    {selectedDay && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Day: {formatReceiptDisplayDate(selectedDay)}</span>
                    )}
                    <button
                        onClick={handleClearFilters}
                        className="ml-auto text-sky-600 hover:text-sky-700"
                    >
                        Clear
                    </button>
                </div>
            )}

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

                {/* Bar Chart */}
                <div className="flex-1 relative border-l border-slate-100 pl-2">
                    <h3 className="text-xs text-slate-500 font-semibold absolute top-0 left-2">Daily Totals</h3>
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
                                        if (target) {
                                            handleDaySelect(target.date);
                                        }
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

        {/* Lower Fold (List) - Scrollable */}
        <div className="flex-1 bg-slate-50 overflow-hidden flex flex-col">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Recent Transactions</h3>
            <div className="overflow-y-auto flex-1 px-4 pb-20 no-scrollbar space-y-3">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">
                        {error}
                    </div>
                )}
                {loading ? (
                    <div className="text-center text-slate-400 py-10">Loading receipts…</div>
                ) : recentReceipts.length === 0 ? (
                    <div className="text-center text-slate-400 py-10">No transactions in the last 7 days.</div>
                ) : filteredReceipts.length === 0 ? (
                    <div className="text-center text-slate-400 py-10">No receipts match the selected filters.</div>
                ) : (
                    filteredReceipts.sort((a,b) => b.createdAt - a.createdAt).map(receipt => (
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