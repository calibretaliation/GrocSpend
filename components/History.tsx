import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { Receipt } from '../types';
import { Search, ChevronDown, ChevronUp, Trash2, Calendar, Pencil, Tag, StickyNote, ChevronRight, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { formatDateInputValue, formatReceiptDisplayDate, isValidDate, parseReceiptDate } from '../utils/date';
import { useReceipts } from '../contexts/ReceiptsContext';
import { useReceiptImages } from '../contexts/ReceiptImagesContext';
import 'react-day-picker/dist/style.css';

interface HistoryProps {
    onEdit?: (receipt: Receipt) => void;
}

interface HighlightedItem {
    receiptId: string;
    itemId: string;
    term: string;
}

interface SearchResult {
    receipt: Receipt;
    item: Receipt['items'][number];
    tagMatches: string[];
    itemTagMatches: string[];
    categoryMatch: boolean;
    noteMatch: boolean;
}

const highlightText = (text: string, term: string): React.ReactNode => {
    if (!term) {
        return text;
    }

    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    let matchIndex = lowerText.indexOf(lowerTerm, cursor);
    let key = 0;

    while (matchIndex !== -1) {
        if (matchIndex > cursor) {
            parts.push(text.slice(cursor, matchIndex));
        }

        const matchedText = text.slice(matchIndex, matchIndex + term.length);
        parts.push(
            <mark key={`match-${key++}`} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5">
                {matchedText}
            </mark>
        );

        cursor = matchIndex + term.length;
        matchIndex = lowerText.indexOf(lowerTerm, cursor);
    }

    if (cursor < text.length) {
        parts.push(text.slice(cursor));
    }

    return parts;
};

export const History: React.FC<HistoryProps> = ({ onEdit }) => {
    const { receipts, loading, remove: removeReceipt, error, saveStates, retrySave } = useReceipts();
    const { removeImage, getImage } = useReceiptImages();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState<'all' | 'month' | 'week' | 'custom'>('all');
    const [customRange, setCustomRange] = useState<DateRange | undefined>();
    const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
    const rangePickerContainerRef = useRef<HTMLDivElement | null>(null);
    const [sortOption, setSortOption] = useState<'added' | 'updated' | 'date'>('added');
    const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
    const [highlightedItem, setHighlightedItem] = useState<HighlightedItem | null>(null);
    const [viewingImage, setViewingImage] = useState<{ receiptId: string; data: string } | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const receiptRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const searchTermTrimmed = searchTerm.trim();
    const isSearching = searchTermTrimmed.length > 0;

    useEffect(() => {
        if (expandedReceiptId && !receipts.some(r => r.id === expandedReceiptId)) {
            setExpandedReceiptId(null);
        }
    }, [expandedReceiptId, receipts]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!rangePickerContainerRef.current) {
                return;
            }
            if (!rangePickerContainerRef.current.contains(event.target as Node)) {
                setIsRangePickerOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setHighlightedItem(prev => (prev ? { ...prev, term: searchTermTrimmed } : null));
    }, [searchTermTrimmed]);

    const customRangeSummary = useMemo(() => {
        if (!customRange?.from && !customRange?.to) {
            return 'Select range';
        }
        if (customRange?.from && !customRange?.to) {
            return formatDateInputValue(customRange.from);
        }
        if (customRange?.from && customRange?.to) {
            return `${formatDateInputValue(customRange.from)} – ${formatDateInputValue(customRange.to)}`;
        }
        return 'Select range';
    }, [customRange]);

    const filteredReceipts = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

        let filtered = receipts.slice();

        if (filterDate === 'month') {
            filtered = filtered.filter(r => {
                const d = parseReceiptDate(r.date);
                return isValidDate(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
        } else if (filterDate === 'week') {
            const oneWeekAgo = new Date(startOfToday);
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            filtered = filtered.filter(r => {
                const d = parseReceiptDate(r.date);
                return isValidDate(d) && d >= oneWeekAgo;
            });
        } else if (filterDate === 'custom' && customRange?.from) {
            const from = new Date(customRange.from);
            const to = customRange.to ? new Date(customRange.to) : customRange.from;
            from.setHours(0, 0, 0, 0);
            to.setHours(23, 59, 59, 999);
            filtered = filtered.filter(r => {
                const d = parseReceiptDate(r.date);
                return isValidDate(d) && d >= from && d <= to;
            });
        }

        filtered.sort((a, b) => {
            if (sortOption === 'added') {
                return b.createdAt - a.createdAt;
            }
            if (sortOption === 'updated') {
                const aUpdated = a.updatedAt ?? a.createdAt;
                const bUpdated = b.updatedAt ?? b.createdAt;
                return bUpdated - aUpdated;
            }

            const aDate = parseReceiptDate(a.date);
            const bDate = parseReceiptDate(b.date);
            if (!isValidDate(aDate) && !isValidDate(bDate)) {
                return 0;
            }
            if (!isValidDate(aDate)) {
                return 1;
            }
            if (!isValidDate(bDate)) {
                return -1;
            }
            return (bDate as Date).getTime() - (aDate as Date).getTime();
        });

        return filtered;
    }, [receipts, filterDate, customRange, sortOption]);

    const searchResults = useMemo<SearchResult[]>(() => {
        if (!isSearching) {
            return [];
        }

        const lowerTerm = searchTermTrimmed.toLowerCase();
        const results: SearchResult[] = [];

        filteredReceipts.forEach(receipt => {
            const tagMatches = receipt.tags.filter(tag => tag.toLowerCase().includes(lowerTerm));

            receipt.items.forEach(item => {
                const nameMatch = item.name.toLowerCase().includes(lowerTerm);
                const categoryMatch = item.category ? item.category.toLowerCase().includes(lowerTerm) : false;
                const itemTagMatches = (item.tags || []).filter(tag => tag.toLowerCase().includes(lowerTerm));
                const noteMatch = item.note ? item.note.toLowerCase().includes(lowerTerm) : false;
                const include = nameMatch || categoryMatch || itemTagMatches.length > 0 || noteMatch || tagMatches.length > 0;

                if (include) {
                    results.push({
                        receipt,
                        item,
                        tagMatches,
                        itemTagMatches,
                        categoryMatch,
                        noteMatch,
                    });
                }
            });
        });

        return results.sort((a, b) => b.receipt.createdAt - a.receipt.createdAt);
    }, [filteredReceipts, isSearching, searchTermTrimmed]);

    const merchantMatches = useMemo(() => {
        if (!isSearching) {
            return [];
        }

        const lowerTerm = searchTermTrimmed.toLowerCase();
        return filteredReceipts.filter(receipt => receipt.merchant.toLowerCase().includes(lowerTerm));
    }, [filteredReceipts, isSearching, searchTermTrimmed]);

    const pendingCount = useMemo(
        () => Object.values(saveStates).filter(state => state === 'pending').length,
        [saveStates]
    );

    const failedCount = useMemo(
        () => Object.values(saveStates).filter(state => state === 'failed').length,
        [saveStates]
    );

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this receipt?')) {
            return;
        }

        try {
            await removeReceipt(id);
            removeImage(id);
            setActionError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : null;
            setActionError(message || 'Failed to delete receipt. Please try again.');
        }
    };

    const handleRetrySave = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await retrySave(id);
            setActionError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : null;
            setActionError(message || 'Failed to retry save. Please try again.');
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedReceiptId(prev => (prev === id ? null : id));
    };

    const handleSelectMatch = (receiptId: string, itemId: string) => {
        setExpandedReceiptId(receiptId);
        setHighlightedItem({ receiptId, itemId, term: searchTermTrimmed });

        requestAnimationFrame(() => {
            const target = receiptRefs.current[receiptId];
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    };

    const handleCustomRangeSelect = (range: DateRange | undefined) => {
        setCustomRange(range);
    };

    const handleClearCustomRange = () => {
        setCustomRange(undefined);
    };

    const renderReceiptCard = (receipt: Receipt, highlightTerm?: string) => {
        const isExpanded = expandedReceiptId === receipt.id;
        const originalImageData = getImage(receipt.id);
        const hasHighlight = Boolean(highlightTerm);
        const normalizedHighlight = highlightTerm?.toLowerCase() ?? '';

        const merchantContent = hasHighlight && receipt.merchant.toLowerCase().includes(normalizedHighlight)
            ? highlightText(receipt.merchant, highlightTerm as string)
            : receipt.merchant;

        const renderReceiptTag = (tag: string) => {
            if (hasHighlight && tag.toLowerCase().includes(normalizedHighlight)) {
                return highlightText(tag, highlightTerm as string);
            }
            if (highlightedItem?.term && expandedReceiptId === receipt.id) {
                return highlightText(tag, highlightedItem.term);
            }
            return tag;
        };

        const renderItemContent = (item: Receipt['items'][number], idx: number) => {
            const isHighlighted = highlightedItem?.receiptId === receipt.id && highlightedItem.itemId === item.id;
            const activeTerm = hasHighlight ? highlightTerm as string : (isHighlighted ? highlightedItem?.term || '' : '');
            const itemNameContent = activeTerm && (hasHighlight || isHighlighted)
                ? highlightText(item.name, activeTerm)
                : item.name;

            const renderItemTag = (tag: string) => {
                if (hasHighlight && tag.toLowerCase().includes(normalizedHighlight)) {
                    return highlightText(tag, highlightTerm as string);
                }
                if (isHighlighted && highlightedItem?.term) {
                    return highlightText(tag, highlightedItem.term);
                }
                return tag;
            };

            const noteContent = item.note
                ? activeTerm
                    ? highlightText(item.note, activeTerm)
                    : item.note
                : null;

            return (
                <div
                    key={item.id || idx}
                    className={`flex justify-between items-center text-slate-700 ${isHighlighted ? 'bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2' : ''}`}
                >
                    <div className="flex-1">
                        <p>{itemNameContent}</p>
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
                        {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {item.tags.map(tag => (
                                    <span key={tag} className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                                        {renderItemTag(tag)}
                                    </span>
                                ))}
                            </div>
                        )}
                        {noteContent && (
                            <p className="text-[10px] text-slate-500 mt-1">{noteContent}</p>
                        )}
                    </div>
                    <span className="font-medium">${item.total.toFixed(2)}</span>
                </div>
            );
        };

        const noteContent = receipt.notes && hasHighlight && receipt.notes.toLowerCase().includes(normalizedHighlight)
            ? highlightText(receipt.notes, highlightTerm as string)
            : receipt.notes;

        return (
            <div
                key={receipt.id}
                ref={el => { receiptRefs.current[receipt.id] = el; }}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
            >
                <div
                    onClick={() => toggleExpand(receipt.id)}
                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                >
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800">{merchantContent}</h3>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{receipt.paymentSource}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{formatReceiptDisplayDate(receipt.date)} • {receipt.items.length} items</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                        <div>
                            <p className="font-bold text-slate-900">${receipt.totalAmount.toFixed(2)}</p>
                        </div>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </div>

                {isExpanded && (
                    <div className="bg-slate-50 p-4 border-t border-slate-100 text-sm animate-in slide-in-from-top-2">
                        {receipt.tags && receipt.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                                {receipt.tags.map(tag => (
                                    <span key={tag} className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full flex items-center">
                                        <Tag size={10} className="mr-1" />
                                        {renderReceiptTag(tag)}
                                    </span>
                                ))}
                            </div>
                        )}

                        {receipt.notes && (
                            <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-100 mb-3 flex items-start gap-2">
                                <StickyNote size={14} className="text-yellow-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-slate-700 italic">{noteContent}</p>
                            </div>
                        )}

                        <h4 className="font-semibold text-slate-500 text-xs uppercase mb-2">Items</h4>
                        <div className="space-y-2 mb-4">
                            {receipt.items.map((item, idx) => renderItemContent(item, idx))}
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 flex-wrap">
                            {originalImageData && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingImage({ receiptId: receipt.id, data: originalImageData });
                                    }}
                                    className="text-slate-600 text-xs flex items-center hover:text-slate-800 font-medium"
                                >
                                    <ImageIcon size={14} className="mr-1" /> View original
                                </button>
                            )}
                            {onEdit && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(receipt); }}
                                    className="text-primary text-xs flex items-center hover:text-sky-700 font-medium"
                                >
                                    <Pencil size={14} className="mr-1" /> Edit
                                </button>
                            )}
                            <button
                                onClick={(e) => handleDelete(receipt.id, e)}
                                className="text-red-500 text-xs flex items-center hover:text-red-700 font-medium"
                            >
                                <Trash2 size={14} className="mr-1" /> Delete
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
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
                    {['all', 'month', 'week', 'custom'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterDate(f as typeof filterDate)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${
                                filterDate === f
                                    ? 'bg-slate-800 text-white border-slate-800'
                                    : 'bg-white text-slate-600 border-slate-300'
                            }`}
                        >
                            {f === 'all' ? 'All Time' : f === 'month' ? 'This Month' : f === 'week' ? 'Last 7 Days' : 'Custom Range'}
                        </button>
                    ))}
                </div>

                {filterDate === 'custom' && (
                    <div className="mt-3" ref={rangePickerContainerRef}>
                        <button
                            type="button"
                            onClick={() => setIsRangePickerOpen(prev => !prev)}
                            className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary"
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
                                        onSelect={handleCustomRangeSelect}
                                        numberOfMonths={1}
                                        defaultMonth={customRange?.from}
                                        className="text-sm"
                                    />
                                    <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                                        <button
                                            type="button"
                                            onClick={handleClearCustomRange}
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

                <div className="mt-3 flex items-center gap-2 text-sm">
                    <span className="text-slate-500 text-xs font-semibold uppercase">Sort By</span>
                    <select
                        value={sortOption}
                        onChange={e => setSortOption(e.target.value as typeof sortOption)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="added">Last Added</option>
                        <option value="updated">Last Updated</option>
                        <option value="date">Receipt Date</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                {(error || actionError) && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg">
                        {actionError || error}
                    </div>
                )}
                {loading ? (
                    <div className="text-center text-slate-400 mt-10">
                        <Calendar className="mx-auto mb-2 opacity-50" size={48} />
                        <p>Loading receipts…</p>
                    </div>
                ) : isSearching ? (
                    searchResults.length > 0 ? (
                        searchResults.map(result => (
                            <button
                                key={`${result.receipt.id}-${result.item.id}`}
                                type="button"
                                onClick={() => handleSelectMatch(result.receipt.id, result.item.id)}
                                className="bg-white w-full text-left rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors"
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="font-semibold text-slate-800">
                                                {highlightText(result.receipt.merchant, searchTermTrimmed)}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {formatReceiptDisplayDate(result.receipt.date)} • {result.receipt.paymentSource}
                                            </p>
                                            {result.tagMatches.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {result.receipt.tags.map(tag => (
                                                        <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                                            {highlightText(tag, searchTermTrimmed)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <ChevronRight size={16} className="text-slate-400 mt-1" />
                                    </div>

                                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-sm font-semibold text-slate-800">
                                            {highlightText(result.item.name, searchTermTrimmed)}
                                        </p>
                                        <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                                            <span>
                                                Qty {result.item.quantity} {result.item.unit}
                                            </span>
                                            <span>
                                                ${result.item.unitPrice.toFixed(2)}/{result.item.unit}
                                            </span>
                                            {result.categoryMatch && result.item.category && (
                                                <span className="uppercase tracking-wide text-[10px] font-semibold text-primary">
                                                    {highlightText(result.item.category, searchTermTrimmed)}
                                                </span>
                                            )}
                                        </div>
                                        {result.item.tags && result.item.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-3">
                                                {result.item.tags.map(tag => (
                                                    <span key={tag} className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                                        {highlightText(tag, searchTermTrimmed)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {result.noteMatch && result.item.note && (
                                            <p className="text-[11px] text-slate-500 mt-3">
                                                {highlightText(result.item.note, searchTermTrimmed)}
                                            </p>
                                        )}
                                        <p className="text-sm font-medium text-slate-700 mt-2">
                                            Total ${result.item.total.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))
                    ) : merchantMatches.length > 0 ? (
                        merchantMatches.map(receipt => renderReceiptCard(receipt, searchTermTrimmed))
                    ) : (
                        <div className="text-center text-slate-400 mt-10">
                            <Calendar className="mx-auto mb-2 opacity-50" size={48} />
                            <p>No matching receipts found.</p>
                        </div>
                    )
                ) : filteredReceipts.length === 0 ? (
                    <div className="text-center text-slate-400 mt-10">
                        <Calendar className="mx-auto mb-2 opacity-50" size={48} />
                        <p>No receipts found.</p>
                    </div>
                ) : (
                    filteredReceipts.map(receipt => renderReceiptCard(receipt))
                )}
            </div>
        </div>
        {viewingImage && (
            <div
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setViewingImage(null)}
            >
                <div
                    className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        onClick={() => setViewingImage(null)}
                        className="absolute top-3 right-3 text-white/80 hover:text-white bg-black/40 rounded-full p-2"
                    >
                        <X size={18} />
                    </button>
                    <div className="bg-slate-900 flex items-center justify-center h-full">
                        <img
                            src={viewingImage.data}
                            alt={`Original receipt ${viewingImage.receiptId}`}
                            className="max-h-[85vh] w-auto object-contain"
                        />
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
