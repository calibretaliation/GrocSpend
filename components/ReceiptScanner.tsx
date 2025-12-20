
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Save, Plus, Trash2, Loader2, ScanLine } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { analyzeReceiptImage } from '../services/geminiService';
import { OCRResult, Receipt, ReceiptItem } from '../types';
import { CATEGORIES, PAYMENT_SOURCES, UNITS } from '../constants';
import { formatDateInputValue } from '../utils/date';
import { useAuth } from '../contexts/AuthContext';
import { useReceipts } from '../contexts/ReceiptsContext';

interface ReceiptScannerProps {
    onSaveSuccess: () => void;
    onCancel?: () => void;
    initialData?: Receipt | null;
}

export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ onSaveSuccess, onCancel, initialData }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [ocrData, setOcrData] = useState<boolean>(false); // Used to toggle form view
    const [error, setError] = useState<string | null>(null);

    const { token, authorizedFetch } = useAuth();
    const { upsert } = useReceipts();

    // Form states
    const [id, setId] = useState<string>('');
    const [merchant, setMerchant] = useState('');
    const [total, setTotal] = useState('');
    const [date, setDate] = useState('');
    const [items, setItems] = useState<ReceiptItem[]>([]);
    const [paymentSource, setPaymentSource] = useState<string>('Credit');
    const [customTags, setCustomTags] = useState<string[]>([]);
    const [newTagInput, setNewTagInput] = useState('');
    const [notes, setNotes] = useState('');
    const [itemTagInputs, setItemTagInputs] = useState<Record<string, string>>({});

    const normalizeReceiptItems = (source: ReceiptItem[] = []): ReceiptItem[] =>
        source.map(item => ({
            ...item,
            tags: Array.isArray(item.tags) ? item.tags : [],
            note: item.note ?? ''
        }));

    // Load initial data if provided (Editing Mode)
    useEffect(() => {
        if (initialData) {
            setId(initialData.id);
            setMerchant(initialData.merchant);
            setTotal(initialData.totalAmount.toString());
            setDate(initialData.date);
            setItems(normalizeReceiptItems(initialData.items));
            setPaymentSource(initialData.paymentSource);
            setCustomTags(initialData.tags.filter(t => !PAYMENT_SOURCES.includes(t as any)));
            setNotes(initialData.notes || '');
            setItemTagInputs({});
            setOcrData(true); // Show form
        } else {
            // Reset if no initial data
            resetForm();
        }
    }, [initialData]);

    const resetForm = () => {
        setId('');
        setMerchant('');
        setTotal('');
        setDate('');
        setItems([]);
        setPaymentSource('Credit');
        setCustomTags([]);
        setNotes('');
        setOcrData(false);
        setImagePreview(null);
        setItemTagInputs({});
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyze = async () => {
        if (!imagePreview) return;
        if (!token) {
            setError("Please log in to analyze receipts.");
            return;
        }
        setIsAnalyzing(true);
        setError(null);
        
        try {
            const base64Data = imagePreview.split(',')[1];
            const result: OCRResult = await analyzeReceiptImage(base64Data, authorizedFetch);
            
            setMerchant(result.merchant || '');
            setTotal(
                typeof result.total === 'number'
                    ? result.total.toFixed(2)
                    : ''
            );
            setDate(result.date || formatDateInputValue(new Date()));
            
            if (result.payment_method && PAYMENT_SOURCES.includes(result.payment_method as any)) {
                setPaymentSource(result.payment_method!);
            }

            // Check if any item is a sale item to auto-add 'sale' tag
            const hasSale = result.items?.some(i => i.is_sale);
            if (hasSale && !customTags.includes('sale')) {
                setCustomTags(prev => [...prev, 'sale']);
            }

            const newItems: ReceiptItem[] = (result.items?.map((item, idx) => ({
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + idx,
                name: item.name,
                quantity: item.qty || 1,
                unit: item.unit || 'ea',
                unitPrice: item.price_per_unit || 0,
                regularPrice: item.regular_price || undefined,
                total: item.total_price || 0,
                category: item.category || 'Groceries',
                tags: item.is_sale ? ['sale'] : [],
                note: ''
            })) ?? []);

            if (result.total) {
                const itemsSum = newItems.reduce((sum, item) => sum + item.total, 0);
                const difference = Number((result.total - itemsSum).toFixed(2));
                if (difference > 0.01) {
                    newItems.push({
                        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-tax`,
                        name: 'Sales Tax',
                        quantity: 1,
                        unit: 'ea',
                        unitPrice: Number(difference.toFixed(2)),
                        total: Number(difference.toFixed(2)),
                        category: 'Other',
                        tags: [],
                        note: ''
                    });
                }
            }
            
            setItems(newItems);
            setOcrData(true); // Switch to form view
            setItemTagInputs({});

        } catch (err) {
            const message = err instanceof Error ? err.message : null;
            setError(message || "Failed to analyze receipt. Please try again or enter manually.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleManualEntry = () => {
         setDate(formatDateInputValue(new Date()));
         setOcrData(true);
    }

    const handleAddItem = () => {
        const newItem: ReceiptItem = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            name: '',
            quantity: 1,
            unit: 'ea',
            unitPrice: 0,
            total: 0,
            category: 'Groceries',
            tags: [],
            note: ''
        };
        setItems([...items, newItem]);
        setItemTagInputs(prev => ({ ...prev, [newItem.id]: '' }));
    };

    const handleItemChange = (index: number, field: keyof ReceiptItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
            newItems[index].total = Number((newItems[index].quantity * newItems[index].unitPrice).toFixed(2));
        }
        setItems(newItems);
        
        // Only update total if it's currently 0 or matches previous sum to avoid overwriting manual total corrections
        const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);
        if (items.length > 0) {
           setTotal(newTotal.toFixed(2));
        }
    };

    const handleDeleteItem = (index: number) => {
        const itemId = items[index]?.id;
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);
        setTotal(newTotal.toFixed(2));
        if (itemId) {
            setItemTagInputs(prev => {
                const { [itemId]: _discard, ...rest } = prev;
                return rest;
            });
        }
    };

    const handleAddTag = () => {
        if (newTagInput.trim()) {
            if (!customTags.includes(newTagInput.trim())) {
                setCustomTags([...customTags, newTagInput.trim()]);
            }
            setNewTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        setCustomTags(customTags.filter(t => t !== tag));
    };

    const handleSave = async () => {
        if (!merchant) {
            setError("Merchant name is required");
            return;
        }

        const cleanedItems = items.map(item => {
            const tagSet = Array.from(new Set((item.tags || []).map(tag => tag.trim()).filter(Boolean)));
            const note = item.note?.trim();
            return {
                ...item,
                tags: tagSet,
                note: note && note.length ? note : undefined,
            };
        });

        const finalReceipt: Receipt = {
            id: id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
            merchant,
            date,
            totalAmount: parseFloat(total) || 0,
            currency: 'USD',
            items: cleanedItems,
            tags: [...customTags, paymentSource],
            notes: notes.trim(),
            paymentSource: paymentSource as any,
            createdAt: initialData ? initialData.createdAt : Date.now(),
            updatedAt: Date.now()
        };

        if (!token) {
            setError("Please log in to save receipts.");
            return;
        }

        setIsSaving(true);
        try {
            await upsert(finalReceipt);
            onSaveSuccess();
        } catch (err) {
            const message = err instanceof Error ? err.message : null;
            setError(message || "Failed to save receipt. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const cancelEdit = () => {
        if (onCancel) {
            onCancel();
        } else {
            setOcrData(false);
            setImagePreview(null);
            setError(null);
        }
    }

    const handleItemTagInputChange = (itemId: string, value: string) => {
        setItemTagInputs(prev => ({ ...prev, [itemId]: value }));
    };

    const handleItemTagAdd = (itemId: string) => {
        const value = (itemTagInputs[itemId] || '').trim();
        if (!value) return;
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            if (item.tags.includes(value)) {
                return item;
            }
            return { ...item, tags: [...item.tags, value] };
        }));
        setItemTagInputs(prev => ({ ...prev, [itemId]: '' }));
    };

    const handleItemTagRemove = (itemId: string, tag: string) => {
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return { ...item, tags: item.tags.filter(t => t !== tag) };
        }));
    };

    // Editing / Form View
    if (ocrData) {
        return (
            <div className="p-4 pb-24">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">{initialData ? 'Edit Receipt' : 'New Receipt'}</h2>
                    <Button variant="ghost" onClick={cancelEdit}>
                        <X />
                    </Button>
                </div>
                
                {imagePreview && (
                    <div className="mb-6 rounded-lg overflow-hidden h-40 relative group">
                        <img src={imagePreview} alt="Receipt" className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="bg-black/50 text-white px-2 py-1 rounded text-xs">Reference Image</span>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <Input label="Merchant" value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="e.g. Costco" />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
                        <Input label="Total ($)" type="number" value={total} onChange={e => setTotal(e.target.value)} />
                    </div>

                    {/* Payment Source */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Payment Source</label>
                        <div className="flex gap-2">
                            {PAYMENT_SOURCES.map(src => (
                                <button
                                    key={src}
                                    onClick={() => setPaymentSource(src)}
                                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                                        paymentSource === src 
                                        ? 'bg-slate-800 text-white border-slate-800' 
                                        : 'bg-white text-slate-600 border-slate-300'
                                    }`}
                                >
                                    {src}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
                        <div className="flex gap-2 mb-2 flex-wrap">
                            {customTags.map(tag => (
                                <span key={tag} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full flex items-center gap-1 border border-primary/20">
                                    #{tag}
                                    <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X size={12} /></button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Add tag (e.g. sale, weekend)" 
                                value={newTagInput}
                                onChange={e => setNewTagInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                                className="text-sm"
                            />
                            <Button variant="secondary" onClick={handleAddTag} type="button">
                                <Plus size={18} />
                            </Button>
                        </div>
                    </div>
                    
                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                        <textarea 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Add notes about this purchase..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary min-h-[80px] text-sm"
                        />
                    </div>

                    <div className="border-t border-slate-200 pt-4 mt-6">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-lg">Items</h3>
                            <Button variant="secondary" onClick={handleAddItem} className="py-1 px-3 text-sm">
                                <Plus size={16} className="inline mr-1"/> Add
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, idx) => (
                                <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-sm relative">
                                    <button 
                                        onClick={() => handleDeleteItem(idx)}
                                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    
                                    <div className="mb-2 pr-6">
                                        <input 
                                            className="w-full font-medium border-b border-transparent focus:border-primary outline-none"
                                            value={item.name}
                                            onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                            placeholder="Item Name"
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-5 gap-2 mb-2">
                                        <div className="col-span-1">
                                            <label className="text-[10px] text-slate-500 block">Qty</label>
                                            <input 
                                                type="number"
                                                className="w-full bg-slate-50 rounded px-1"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="col-span-1">
                                             <label className="text-[10px] text-slate-500 block">Unit</label>
                                             <select
                                                className="w-full bg-slate-50 rounded px-1"
                                                value={item.unit}
                                                onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                             >
                                                {UNITS.map(unit => (
                                                    <option key={unit} value={unit}>{unit}</option>
                                                ))}
                                                {!UNITS.includes(item.unit) && item.unit && (
                                                    <option value={item.unit}>{item.unit}</option>
                                                )}
                                             </select>
                                        </div>
                                        <div className="col-span-1">
                                             <label className="text-[10px] text-slate-500 block text-accent">Reg Price</label>
                                             <input 
                                                type="number"
                                                placeholder="-"
                                                className="w-full bg-slate-50 rounded px-1 text-slate-400 focus:text-slate-900"
                                                value={item.regularPrice || ''}
                                                onChange={(e) => handleItemChange(idx, 'regularPrice', Number(e.target.value) || undefined)}
                                            />
                                        </div>
                                        <div className="col-span-1">
                                             <label className="text-[10px] text-slate-500 block font-semibold text-primary">Price</label>
                                             <input 
                                                type="number"
                                                className="w-full bg-slate-50 rounded px-1 font-semibold"
                                                value={item.unitPrice}
                                                onChange={(e) => handleItemChange(idx, 'unitPrice', Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="col-span-1">
                                             <label className="text-[10px] text-slate-500 block text-right">Total</label>
                                             <div className="text-right font-mono font-medium">${item.total.toFixed(2)}</div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                         <select 
                                            className="text-xs bg-slate-100 rounded px-2 py-1 text-slate-600 w-full"
                                            value={item.category}
                                            onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                                         >
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            {!CATEGORIES.includes(item.category) && item.category && (
                                                <option value={item.category}>{item.category}</option>
                                            )}
                                         </select>
                                    </div>

                                    <div className="mt-3">
                                        <label className="text-[10px] text-slate-500 block uppercase tracking-wide mb-1">Item Tags</label>
                                        {item.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {item.tags.map(tag => (
                                                    <span key={tag} className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-primary/20">
                                                        #{tag}
                                                        <button type="button" onClick={() => handleItemTagRemove(item.id, tag)} className="hover:text-red-500">
                                                            <X size={10} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 bg-slate-50 rounded px-2 py-1 text-xs"
                                                placeholder="Add tag"
                                                value={itemTagInputs[item.id] || ''}
                                                onChange={(e) => handleItemTagInputChange(item.id, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleItemTagAdd(item.id);
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleItemTagAdd(item.id)}
                                                className="px-2 py-1 text-xs bg-slate-800 text-white rounded"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <label className="text-[10px] text-slate-500 block uppercase tracking-wide mb-1">Item Note</label>
                                        <textarea
                                            className="w-full bg-slate-50 rounded px-2 py-1 text-xs min-h-[48px]"
                                            placeholder="Add item note"
                                            value={item.note || ''}
                                            onChange={(e) => handleItemChange(idx, 'note', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 sticky bottom-0 bg-slate-50 pb-4">
                        {error && <p className="text-red-500 text-sm mb-2 text-center">{error}</p>}
                        <Button fullWidth onClick={() => void handleSave()} disabled={isSaving} className="shadow-lg shadow-primary/30">
                            <Save size={18} className="inline mr-2" />
                            {isSaving ? 'Saving...' : initialData ? 'Update Receipt' : 'Save Receipt'}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Scanning / Landing View
    return (
        <div className="p-6 flex flex-col items-center justify-center min-h-[80vh] text-center">
            <h2 className="text-2xl font-bold mb-8">Add New Receipt</h2>
            
            {!imagePreview ? (
                <div className="w-full space-y-4">
                    <div className="relative">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <Button 
                            onClick={() => fileInputRef.current?.click()} 
                            fullWidth 
                            className="h-32 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-primary bg-primary/5 hover:bg-primary/10 text-primary"
                        >
                            <Camera size={32} />
                            <span>Scan with Camera</span>
                        </Button>
                    </div>
                    
                    <div className="relative">
                         <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="upload-file"
                        />
                         <Button 
                            variant="secondary"
                            fullWidth 
                            onClick={() => document.getElementById('upload-file')?.click()}
                            className="flex items-center justify-center gap-2"
                        >
                            <Upload size={18} />
                            <span>Upload from Gallery</span>
                        </Button>
                    </div>

                    <div className="relative pt-4">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center">
                            <span className="px-2 bg-slate-50 text-sm text-slate-400">or</span>
                        </div>
                    </div>

                     <Button 
                        variant="ghost"
                        fullWidth 
                        onClick={handleManualEntry}
                        className="text-slate-500"
                    >
                        Enter Manually
                    </Button>
                </div>
            ) : (
                <div className="w-full max-w-sm">
                    <div className="rounded-xl overflow-hidden shadow-lg mb-6 border border-slate-200 relative">
                        <img src={imagePreview} alt="Preview" className="w-full max-h-[60vh] object-contain bg-black" />
                        <button 
                            onClick={() => { setImagePreview(null); setError(null); }}
                            className="absolute top-2 right-2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
                            {error}
                        </div>
                    )}

                    <Button 
                        onClick={() => void handleAnalyze()} 
                        fullWidth 
                        disabled={isAnalyzing}
                        className="shadow-xl"
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 size={18} className="animate-spin inline mr-2" />
                                Extracting Data...
                            </>
                        ) : (
                            <>
                                <ScanLine size={18} className="inline mr-2" />
                                Extract Receipt Info
                            </>
                        )}
                    </Button>
                    
                    {!isAnalyzing && (
                         <Button variant="ghost" className="mt-2 text-sm text-slate-500" onClick={handleManualEntry}>
                            Skip and Edit Manually
                         </Button>
                    )}
                </div>
            )}
        </div>
    );
};
