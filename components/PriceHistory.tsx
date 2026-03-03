import React, { useMemo, useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
    ReferenceLine, CartesianGrid,
} from 'recharts';
import {
    Search, TrendingUp, TrendingDown, Minus, ArrowLeft,
    ShoppingCart, Store, AlertTriangle, Sparkles, Hash,
} from 'lucide-react';
import { useReceipts } from '../contexts/ReceiptsContext';
import { formatReceiptDisplayDate, parseReceiptDate, isValidDate } from '../utils/date';

/* ─── types ────────────────────────────────────── */
interface PricePoint {
    date: string;       // YYYY-MM-DD
    dateTs: number;     // timestamp for sorting
    unitPrice: number;
    regularPrice?: number;
    merchant: string;
    quantity: number;
    unit: string;
    receiptId: string;
}

interface ItemAggregate {
    key: string;          // lowercase trimmed name
    displayName: string;  // first-seen casing
    points: PricePoint[];
    avgPrice: number;
    latestPrice: number;
    lowestPrice: number;
    highestPrice: number;
    count: number;
    merchants: Map<string, { avg: number; last: number; count: number; lastDate: string }>;
    trend: 'up' | 'down' | 'stable';
    trendPct: number;     // % change latest vs avg
}

/* ─── helpers ──────────────────────────────────── */
const normalizeItemName = (name: string) => name.trim().toLowerCase();

const MERCHANT_COLORS = [
    '#0ea5e9', '#f43f5e', '#10b981', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

/* ─── component ────────────────────────────────── */
export const PriceHistory: React.FC = () => {
    const { receipts, loading } = useReceipts();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    /* Build item aggregates from all receipts */
    const itemMap = useMemo(() => {
        const map = new Map<string, ItemAggregate>();

        receipts.forEach(receipt => {
            const receiptDate = parseReceiptDate(receipt.date);
            if (!isValidDate(receiptDate)) return;

            receipt.items.forEach(item => {
                if (!item.name?.trim()) return;
                const key = normalizeItemName(item.name);

                if (!map.has(key)) {
                    map.set(key, {
                        key,
                        displayName: item.name.trim(),
                        points: [],
                        avgPrice: 0,
                        latestPrice: 0,
                        lowestPrice: Infinity,
                        highestPrice: -Infinity,
                        count: 0,
                        merchants: new Map(),
                        trend: 'stable',
                        trendPct: 0,
                    });
                }

                const agg = map.get(key)!;
                const point: PricePoint = {
                    date: receipt.date,
                    dateTs: receiptDate.getTime(),
                    unitPrice: item.unitPrice,
                    regularPrice: item.regularPrice,
                    merchant: receipt.merchant,
                    quantity: item.quantity,
                    unit: item.unit,
                    receiptId: receipt.id,
                };
                agg.points.push(point);
                agg.count++;

                /* merchant stats */
                const mKey = receipt.merchant;
                const existing = agg.merchants.get(mKey);
                if (existing) {
                    existing.avg = (existing.avg * existing.count + item.unitPrice) / (existing.count + 1);
                    existing.count++;
                    if (receipt.date > existing.lastDate) {
                        existing.last = item.unitPrice;
                        existing.lastDate = receipt.date;
                    }
                } else {
                    agg.merchants.set(mKey, {
                        avg: item.unitPrice,
                        last: item.unitPrice,
                        count: 1,
                        lastDate: receipt.date,
                    });
                }
            });
        });

        /* Finalize aggregates */
        map.forEach(agg => {
            agg.points.sort((a, b) => a.dateTs - b.dateTs);
            const prices = agg.points.map(p => p.unitPrice);
            agg.avgPrice = prices.reduce((s, v) => s + v, 0) / prices.length;
            agg.latestPrice = prices[prices.length - 1];
            agg.lowestPrice = Math.min(...prices);
            agg.highestPrice = Math.max(...prices);

            const pctChange = ((agg.latestPrice - agg.avgPrice) / agg.avgPrice) * 100;
            agg.trendPct = pctChange;
            if (pctChange > 15) agg.trend = 'up';
            else if (pctChange < -15) agg.trend = 'down';
            else agg.trend = 'stable';
        });

        return map;
    }, [receipts]);

    /* Frequently purchased: 3+ times, sorted by count */
    const frequentItems = useMemo(() =>
        Array.from(itemMap.values())
            .filter(a => a.count >= 3)
            .sort((a, b) => b.count - a.count),
        [itemMap],
    );

    /* All items sorted alphabetically for search */
    const allItems = useMemo(() =>
        Array.from(itemMap.values()).sort((a, b) =>
            a.displayName.localeCompare(b.displayName)),
        [itemMap],
    );

    /* Search results */
    const searchResults = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return [];
        return allItems.filter(a => a.key.includes(term));
    }, [allItems, searchTerm]);

    /* Selected item detail */
    const detail = selectedItem ? itemMap.get(selectedItem) ?? null : null;

    /* Chart data for selected item */
    const chartData = useMemo(() => {
        if (!detail) return [];
        return detail.points.map(p => ({
            date: formatReceiptDisplayDate(p.date),
            rawDate: p.date,
            price: p.unitPrice,
            regularPrice: p.regularPrice,
            merchant: p.merchant,
        }));
    }, [detail]);

    /* Merchant list for comparison */
    const merchantList = useMemo(() => {
        if (!detail) return [];
        return Array.from(detail.merchants.entries())
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => a.avg - b.avg);
    }, [detail]);

    /* Unique merchants for chart coloring */
    const merchantColorMap = useMemo(() => {
        if (!detail) return new Map<string, string>();
        const map = new Map<string, string>();
        const merchants = [...new Set(detail.points.map(p => p.merchant))];
        merchants.forEach((m, i) => map.set(m, MERCHANT_COLORS[i % MERCHANT_COLORS.length]));
        return map;
    }, [detail]);

    const hasRegularPrice = detail?.points.some(p => p.regularPrice && p.regularPrice !== p.unitPrice);
    const avgRegularPrice = hasRegularPrice
        ? detail!.points
            .filter(p => p.regularPrice)
            .reduce((s, p) => s + (p.regularPrice ?? 0), 0) /
        detail!.points.filter(p => p.regularPrice).length
        : undefined;

    /* ─── Trend icon helper ─── */
    const TrendIcon = ({ trend, size = 14 }: { trend: 'up' | 'down' | 'stable'; size?: number }) => {
        if (trend === 'up') return <TrendingUp size={size} className="text-red-500" />;
        if (trend === 'down') return <TrendingDown size={size} className="text-emerald-500" />;
        return <Minus size={size} className="text-slate-400" />;
    };

    const TrendBadge = ({ agg }: { agg: ItemAggregate }) => {
        if (agg.trend === 'up') {
            return (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    <AlertTriangle size={10} /> Price Up {Math.abs(agg.trendPct).toFixed(0)}%
                </span>
            );
        }
        if (agg.trend === 'down') {
            return (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">
                    <Sparkles size={10} /> Deal {Math.abs(agg.trendPct).toFixed(0)}% off
                </span>
            );
        }
        return null;
    };

    /* ─── Detail View ─── */
    if (detail) {
        return (
            <div className="flex flex-col h-full bg-slate-50">
                {/* Header */}
                <div className="bg-white p-4 border-b border-slate-200 shadow-sm sticky top-0 z-10">
                    <button
                        onClick={() => setSelectedItem(null)}
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 mb-3 transition-colors"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{detail.displayName}</h2>
                            <p className="text-xs text-slate-500 mt-1">
                                {detail.count} purchase{detail.count > 1 ? 's' : ''} · {detail.merchants.size} merchant{detail.merchants.size > 1 ? 's' : ''}
                            </p>
                        </div>
                        <TrendBadge agg={detail} />
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-4 gap-2 mt-4">
                        {[
                            { label: 'Latest', value: `$${detail.latestPrice.toFixed(2)}`, accent: false },
                            { label: 'Average', value: `$${detail.avgPrice.toFixed(2)}`, accent: false },
                            { label: 'Lowest', value: `$${detail.lowestPrice.toFixed(2)}`, accent: true },
                            { label: 'Highest', value: `$${detail.highestPrice.toFixed(2)}`, accent: false },
                        ].map(stat => (
                            <div key={stat.label} className={`rounded-lg p-2 text-center ${stat.accent ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
                                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{stat.label}</p>
                                <p className={`text-sm font-bold ${stat.accent ? 'text-emerald-600' : 'text-slate-800'}`}>{stat.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-6">
                    {/* Price Timeline */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <TrendingUp size={14} className="text-primary" /> Price Timeline
                        </h3>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={v => `$${v}`}
                                        width={45}
                                    />
                                    <Tooltip
                                        formatter={(value: number, _name: string, entry: any) => [
                                            `$${value.toFixed(2)}`,
                                            entry.payload.merchant,
                                        ]}
                                        labelFormatter={(label) => label}
                                        contentStyle={{
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            fontSize: '12px',
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="price"
                                        stroke="#0ea5e9"
                                        strokeWidth={2}
                                        dot={(props: any) => {
                                            const { cx, cy, payload } = props;
                                            const color = merchantColorMap.get(payload.merchant) || '#0ea5e9';
                                            return (
                                                <circle
                                                    key={`${cx}-${cy}`}
                                                    cx={cx}
                                                    cy={cy}
                                                    r={5}
                                                    fill={color}
                                                    stroke="#fff"
                                                    strokeWidth={2}
                                                />
                                            );
                                        }}
                                        activeDot={{ r: 7 }}
                                    />
                                    <ReferenceLine
                                        y={detail.avgPrice}
                                        stroke="#94a3b8"
                                        strokeDasharray="4 4"
                                        label={{ value: 'Avg', position: 'right', fontSize: 10, fill: '#94a3b8' }}
                                    />
                                    {avgRegularPrice && (
                                        <ReferenceLine
                                            y={avgRegularPrice}
                                            stroke="#f59e0b"
                                            strokeDasharray="6 3"
                                            label={{ value: 'Reg', position: 'right', fontSize: 10, fill: '#f59e0b' }}
                                        />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Legend: merchants */}
                        {detail.merchants.size > 1 && (
                            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
                                {Array.from(merchantColorMap.entries()).map(([merchant, color]) => (
                                    <div key={merchant} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                        {merchant}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Merchant Comparison */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <Store size={14} className="text-primary" /> Merchant Comparison
                        </h3>
                        <div className="divide-y divide-slate-100">
                            {merchantList.map((m, idx) => (
                                <div key={m.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                                    <div className="flex items-center gap-3">
                                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${idx === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {idx + 1}
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">{m.name}</p>
                                            <p className="text-[11px] text-slate-400">{m.count} purchase{m.count > 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold ${idx === 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                                            ${m.avg.toFixed(2)} avg
                                        </p>
                                        <p className="text-[11px] text-slate-400">Last: ${m.last.toFixed(2)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Purchase History List */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <Hash size={14} className="text-primary" /> All Purchases
                        </h3>
                        <div className="divide-y divide-slate-100">
                            {detail.points.slice().reverse().map((p, idx) => (
                                <div key={`${p.receiptId}-${idx}`} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                                    <div>
                                        <p className="text-sm text-slate-700">{p.merchant}</p>
                                        <p className="text-[11px] text-slate-400">
                                            {formatReceiptDisplayDate(p.date)} · {p.quantity} {p.unit}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-slate-800">${p.unitPrice.toFixed(2)}</p>
                                        {p.regularPrice && p.regularPrice > p.unitPrice && (
                                            <p className="text-[10px] line-through text-slate-400">${p.regularPrice.toFixed(2)}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ─── Landing / Search View ─── */
    const showSearchResults = searchTerm.trim().length > 0;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Price Tracker</h2>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search item by name…"
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
                {loading ? (
                    <div className="text-center text-slate-400 mt-10">
                        <ShoppingCart className="mx-auto mb-2 opacity-50" size={48} />
                        <p>Loading items…</p>
                    </div>
                ) : showSearchResults ? (
                    searchResults.length > 0 ? (
                        searchResults.map(agg => (
                            <button
                                key={agg.key}
                                type="button"
                                onClick={() => { setSelectedItem(agg.key); setSearchTerm(''); }}
                                className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-left hover:border-slate-300 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-slate-800">{agg.displayName}</p>
                                            <TrendBadge agg={agg} />
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {agg.count} purchase{agg.count > 1 ? 's' : ''} · {agg.merchants.size} merchant{agg.merchants.size > 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <div className="text-right flex items-center gap-2">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">${agg.latestPrice.toFixed(2)}</p>
                                            <p className="text-[11px] text-slate-400">avg ${agg.avgPrice.toFixed(2)}</p>
                                        </div>
                                        <TrendIcon trend={agg.trend} />
                                    </div>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="text-center text-slate-400 mt-10">
                            <Search className="mx-auto mb-2 opacity-50" size={48} />
                            <p>No items match "{searchTerm}"</p>
                        </div>
                    )
                ) : (
                    <>
                        {/* Frequently Purchased */}
                        {frequentItems.length > 0 && (
                            <>
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Frequently Purchased
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {frequentItems.slice(0, 20).map(agg => (
                                        <button
                                            key={agg.key}
                                            type="button"
                                            onClick={() => setSelectedItem(agg.key)}
                                            className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 text-left hover:border-primary/40 hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-start justify-between mb-1.5">
                                                <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2">{agg.displayName}</p>
                                                <TrendIcon trend={agg.trend} size={12} />
                                            </div>
                                            <div className="flex items-end justify-between mt-2">
                                                <div>
                                                    <p className="text-lg font-bold text-slate-800">${agg.latestPrice.toFixed(2)}</p>
                                                    <p className="text-[10px] text-slate-400">avg ${agg.avgPrice.toFixed(2)}</p>
                                                </div>
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                                                    ×{agg.count}
                                                </span>
                                            </div>
                                            <TrendBadge agg={agg} />
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* All Items */}
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4">
                            All Items ({allItems.length})
                        </h3>
                        {allItems.map(agg => (
                            <button
                                key={agg.key}
                                type="button"
                                onClick={() => setSelectedItem(agg.key)}
                                className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-3 text-left hover:border-slate-300 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">{agg.displayName}</p>
                                        <p className="text-[11px] text-slate-400">{agg.count}× · {agg.merchants.size} store{agg.merchants.size > 1 ? 's' : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-3">
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-slate-700">${agg.latestPrice.toFixed(2)}</p>
                                        </div>
                                        <TrendIcon trend={agg.trend} size={12} />
                                    </div>
                                </div>
                            </button>
                        ))}

                        {allItems.length === 0 && (
                            <div className="text-center text-slate-400 mt-10">
                                <ShoppingCart className="mx-auto mb-2 opacity-50" size={48} />
                                <p>No items yet. Scan a receipt to get started!</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
