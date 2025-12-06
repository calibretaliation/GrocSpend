
import React, { useState, useMemo } from 'react';
import { getReceipts, deleteReceipt } from '../services/storageService';
import { Receipt } from '../types';
import { Search, ChevronDown, ChevronUp, Trash2, Calendar, Pencil, Tag, StickyNote } from 'lucide-react';
import { formatReceiptDisplayDate, isValidDate, parseReceiptDate } from '../utils/date';

interface HistoryProps {
    onEdit?: (receipt: Receipt) => void;
}

export const History: React.FC<HistoryProps> = ({ onEdit }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('all'); // all, month, week
    const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const receipts = useMemo(() => getReceipts(), [refreshTrigger]);

    const filteredReceipts = useMemo(() => {
        let filtered = receipts;

        // Date Filter
        const now = new Date();
        if (filterDate === 'month') {
            filtered = filtered.filter(r => {
                const d = parseReceiptDate(r.date);
                if (!isValidDate(d)) {
                    return false;
                }
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
        } else if (filterDate === 'week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            filtered = filtered.filter(r => {
                const d = parseReceiptDate(r.date);
                return isValidDate(d) && d >= oneWeekAgo;
            });
        }

        // Text Search
        if (searchTerm.trim()) {
            const lowerTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(r => 
                r.merchant.toLowerCase().includes(lowerTerm) ||
                r.tags.some(t => t.toLowerCase().includes(lowerTerm)) ||
                r.items.some(i => i.name.toLowerCase().includes(lowerTerm))
            );
        }

        return filtered.sort((a,b) => b.createdAt - a.createdAt);
    }, [receipts, searchTerm, filterDate]);

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(confirm('Are you sure you want to delete this receipt?')) {
            deleteReceipt(id);
            setRefreshTrigger(prev => prev + 1);
        }
    }

    const toggleExpand = (id: string) => {
        setExpandedReceiptId(expandedReceiptId === id ? null : id);
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="bg-white p-4 shadow-sm z-10 sticky top-0">
                <h2 className="text-2xl font-bold mb-4">History</h2>
                
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Search merchant, item..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {['all', 'month', 'week'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterDate(f)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${
                                filterDate === f 
                                ? 'bg-slate-800 text-white border-slate-800' 
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                        >
                            {f === 'all' ? 'All Time' : f === 'month' ? 'This Month' : 'Last 7 Days'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                {filteredReceipts.length === 0 ? (
                    <div className="text-center text-slate-400 mt-10">
                        <Calendar className="mx-auto mb-2 opacity-50" size={48} />
                        <p>No receipts found.</p>
                    </div>
                ) : (
                    filteredReceipts.map(r => (
                        <div key={r.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div 
                                onClick={() => toggleExpand(r.id)}
                                className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-slate-800">{r.merchant}</h3>
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{r.paymentSource}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">{formatReceiptDisplayDate(r.date)} • {r.items.length} items</p>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    <div>
                                        <p className="font-bold text-slate-900">${r.totalAmount.toFixed(2)}</p>
                                    </div>
                                    {expandedReceiptId === r.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </div>

                            {expandedReceiptId === r.id && (
                                <div className="bg-slate-50 p-4 border-t border-slate-100 text-sm animate-in slide-in-from-top-2">
                                    {/* Tags Display */}
                                    {r.tags && r.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {r.tags.map(tag => (
                                                <span key={tag} className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full flex items-center">
                                                    <Tag size={10} className="mr-1"/> {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Notes Display */}
                                    {r.notes && (
                                        <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-100 mb-3 flex items-start gap-2">
                                            <StickyNote size={14} className="text-yellow-600 mt-0.5 shrink-0" />
                                            <p className="text-xs text-slate-700 italic">{r.notes}</p>
                                        </div>
                                    )}

                                    <h4 className="font-semibold text-slate-500 text-xs uppercase mb-2">Items</h4>
                                    <div className="space-y-2 mb-4">
                                        {r.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-slate-700">
                                                <div className="flex-1">
                                                    <p>{item.name}</p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {item.quantity} {item.unit} @ 
                                                        {item.regularPrice && item.regularPrice > item.unitPrice ? (
                                                            <>
                                                                <span className="line-through text-slate-300 ml-1 mr-1">${item.regularPrice}</span>
                                                                <span className="text-red-500 font-semibold">${item.unitPrice}</span>
                                                            </>
                                                        ) : (
                                                            ` $${item.unitPrice}`
                                                        )}
                                                        /{item.unit}
                                                    </p>
                                                </div>
                                                <span className="font-medium">${item.total.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
                                        {onEdit && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onEdit(r); }}
                                                className="text-primary text-xs flex items-center hover:text-sky-700 font-medium"
                                            >
                                                <Pencil size={14} className="mr-1" /> Edit
                                            </button>
                                        )}
                                        <button 
                                            onClick={(e) => handleDelete(r.id, e)}
                                            className="text-red-500 text-xs flex items-center hover:text-red-700 font-medium"
                                        >
                                            <Trash2 size={14} className="mr-1" /> Delete
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
