
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, X, Save, Plus, Trash2, Loader2, ScanLine, BookmarkPlus, Pencil } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { analyzeReceiptImage } from '../services/geminiService';
import { OCRResult, Receipt, ReceiptItem, ReceiptPreset } from '../types';
import { CATEGORIES, PAYMENT_SOURCES, UNITS } from '../constants';
import { formatDateInputValue, isValidDate, parseReceiptDate } from '../utils/date';
import { useAuth } from '../contexts/AuthContext';
import { useReceipts } from '../contexts/ReceiptsContext';
import { useReceiptPresets } from '../contexts/ReceiptPresetsContext';
import { useReceiptImages } from '../contexts/ReceiptImagesContext';

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
    const { upsert, quickAdd, saveStates } = useReceipts();
    const { presets, addPreset, removePreset, updatePreset } = useReceiptPresets();
    const { setImage, removeImage } = useReceiptImages();

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
    const [isPresetMode, setIsPresetMode] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [presetError, setPresetError] = useState<string | null>(null);
    const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
    const isEditingPreset = isPresetMode && Boolean(editingPresetId);
    const [optimizedImageData, setOptimizedImageData] = useState<string | null>(null);
    const [showSaveToast, setShowSaveToast] = useState<{ state: 'pending' | 'failed'; receiptId: string } | null>(null);

    const normalizeReceiptItems = (source: ReceiptItem[] = []): ReceiptItem[] =>
        source.map(item => ({
            ...item,
            tags: Array.isArray(item.tags) ? item.tags : [],
            note: item.note ?? ''
        }));

    const clonePresetItems = (source: ReceiptItem[] = []): ReceiptItem[] =>
        normalizeReceiptItems(source).map((item, index) => ({
            ...item,
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`
        }));

    const buildReceiptFromPreset = (preset: ReceiptPreset): Receipt => {
        const itemsFromPreset = clonePresetItems(preset.items);
        const normalizedTotal = Number.isFinite(Number(preset.totalAmount))
            ? Number(Number(preset.totalAmount).toFixed(2))
            : 0;
        const note = preset.notes?.trim();
        const combinedTags = Array.from(
            new Set([
                ...(preset.tags || []).map(tag => tag.trim()).filter(Boolean),
                preset.paymentSource
            ])
        );

        return {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            merchant: preset.merchant,
            date: formatDateInputValue(new Date()),
            totalAmount: normalizedTotal,
            currency: preset.currency || 'USD',
            paymentSource: preset.paymentSource,
            items: itemsFromPreset,
            tags: combinedTags,
            notes: note && note.length ? note : undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
    };

    const optimizeImageDataUrl = useCallback(async (dataUrl: string): Promise<string> => {
        return new Promise((resolve) => {
            const image = new Image();
            image.onload = () => {
                try {
                    const maxDimension = 1280;
                    let { width, height } = image;
                    let targetWidth = width;
                    let targetHeight = height;

                    if (width > maxDimension || height > maxDimension) {
                        const scale = Math.min(maxDimension / width, maxDimension / height);
                        targetWidth = Math.round(width * scale);
                        targetHeight = Math.round(height * scale);
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    const context = canvas.getContext('2d');
                    if (!context) {
                        resolve(dataUrl);
                        return;
                    }
                    context.drawImage(image, 0, 0, targetWidth, targetHeight);
                    const optimized = canvas.toDataURL('image/webp', 0.75);
                    resolve(optimized.length < dataUrl.length ? optimized : dataUrl);
                } catch (error) {
                    resolve(dataUrl);
                }
            };
            image.onerror = () => resolve(dataUrl);
            image.src = dataUrl;
        });
    }, []);

    useEffect(() => {
        let isCancelled = false;
        if (!imagePreview) {
            setOptimizedImageData(null);
            return () => {
                isCancelled = true;
            };
        }

        let active = true;
        void optimizeImageDataUrl(imagePreview).then((result) => {
            if (!isCancelled && active) {
                setOptimizedImageData(result);
            }
        });

        return () => {
            isCancelled = true;
            active = false;
        };
    }, [imagePreview, optimizeImageDataUrl]);

    useEffect(() => {
        if (!showSaveToast) {
            return;
        }
        const timeout = setTimeout(() => setShowSaveToast(null), 2500);
        return () => clearTimeout(timeout);
    }, [showSaveToast]);

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
            setIsPresetMode(false);
            setPresetName('');
            setPresetError(null);
            setEditingPresetId(null);
        } else {
            // Reset if no initial data
            resetForm();
        }
    }, [initialData]);

    const clearFormValues = () => {
        setId('');
        setMerchant('');
        setTotal('');
        setDate('');
        setItems([]);
        setPaymentSource('Credit');
        setCustomTags([]);
        setNotes('');
        setItemTagInputs({});
        setNewTagInput('');
    };

    const resetForm = () => {
        clearFormValues();
        setOcrData(false);
        setImagePreview(null);
        setIsPresetMode(false);
        setPresetName('');
        setPresetError(null);
        setEditingPresetId(null);
        setError(null);
        setOptimizedImageData(null);
    };

    const beginPresetCreate = () => {
        clearFormValues();
        setPresetName('');
        setPresetError(null);
        setEditingPresetId(null);
        setIsPresetMode(true);
        setDate(formatDateInputValue(new Date()));
        setOcrData(true);
        setImagePreview(null);
        setError(null);
        setOptimizedImageData(null);
    };

    const loadPresetIntoForm = (preset: ReceiptPreset) => {
        setId('');
        setMerchant(preset.merchant);
        setTotal(preset.totalAmount.toFixed(2));
        setDate(formatDateInputValue(new Date()));
        setItems(clonePresetItems(preset.items));
        setPaymentSource(preset.paymentSource);
        setCustomTags([...preset.tags]);
        setNotes(preset.notes || '');
        setItemTagInputs({});
        setNewTagInput('');
        setImagePreview(null);
        setError(null);
    };

    const handlePresetSave = () => {
        const trimmedName = presetName.trim();
        const trimmedMerchant = merchant.trim();

        setPresetError(null);

        if (!trimmedName) {
            setPresetError('Preset name is required');
            return;
        }

        if (!trimmedMerchant) {
            setPresetError('Merchant is required before saving a preset');
            return;
        }

        const parsedTotal = parseFloat(total);
        const computedTotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
        const safeTotal = Number.isFinite(parsedTotal) ? parsedTotal : Number(computedTotal.toFixed(2));
        const uniqueTags = Array.from(new Set(customTags.map(tag => tag.trim()).filter(Boolean)));

        try {
            const presetPayload: Omit<ReceiptPreset, 'id'> = {
                name: trimmedName,
                merchant: trimmedMerchant,
                totalAmount: Number.isFinite(safeTotal) ? Number(safeTotal.toFixed(2)) : 0,
                currency: 'USD',
                paymentSource: paymentSource as Receipt['paymentSource'],
                items: normalizeReceiptItems(items).map(item => ({ ...item })),
                tags: uniqueTags,
                notes: notes.trim() ? notes.trim() : undefined
            };

            if (editingPresetId) {
                updatePreset({ ...presetPayload, id: editingPresetId });
            } else {
                addPreset(presetPayload);
            }
            resetForm();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to save preset';
            setPresetError(message);
        }
    };

    const handleUsePreset = (preset: ReceiptPreset) => {
        if (!token) {
            setError('Please log in to save receipts.');
            return;
        }

        setIsPresetMode(false);
        setEditingPresetId(null);
        setPresetName('');
        setPresetError(null);
        setError(null);

        const receipt = buildReceiptFromPreset(preset);
        const pending = quickAdd(receipt);
        resetForm();
        onSaveSuccess();
        setShowSaveToast({ state: 'pending', receiptId: receipt.id });
        void pending.catch(() => {
            // Errors are handled centrally in the receipts context.
            setShowSaveToast({ state: 'failed', receiptId: receipt.id });
        });
    };

    const handlePresetEdit = (preset: ReceiptPreset) => {
        setIsPresetMode(true);
        setEditingPresetId(preset.id);
        setPresetName(preset.name);
        setPresetError(null);
        loadPresetIntoForm(preset);
        setOcrData(true);
    };

    const handlePresetRemove = (presetId: string) => {
        const wasEditing = editingPresetId === presetId;
        if (wasEditing) {
            setEditingPresetId(null);
        }
        removePreset(presetId);
        if (isPresetMode && wasEditing) {
            resetForm();
        }
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
            const normalizedDate = result.date ? parseReceiptDate(result.date) : null;
            setDate(
                normalizedDate && isValidDate(normalizedDate)
                    ? formatDateInputValue(normalizedDate)
                    : formatDateInputValue(new Date())
            );
            
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
            setIsPresetMode(false);
            setEditingPresetId(null);
            setPresetName('');
            setPresetError(null);
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
        setIsPresetMode(false);
        setEditingPresetId(null);
        setPresetName('');
        setPresetError(null);
        clearFormValues();
        setDate(formatDateInputValue(new Date()));
        setOcrData(true);
        setImagePreview(null);
        setError(null);
        setOptimizedImageData(null);
    };

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

        const isExisting = Boolean(id);
        const uniqueTags = Array.from(new Set([...customTags.map(tag => tag.trim()).filter(Boolean), paymentSource]));
        const imageDataForStorage = optimizedImageData || imagePreview;

        const finalReceipt: Receipt = {
            id: id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
            merchant: merchant.trim(),
            date,
            totalAmount: parseFloat(total) || 0,
            currency: 'USD',
            items: cleanedItems,
            tags: uniqueTags,
            notes: notes.trim() ? notes.trim() : undefined,
            paymentSource: paymentSource as any,
            createdAt: initialData ? initialData.createdAt : Date.now(),
            updatedAt: Date.now()
        };

        if (!token) {
            setError("Please log in to save receipts.");
            return;
        }

        if (isExisting) {
            setIsSaving(true);
            try {
                await upsert(finalReceipt);
                if (imageDataForStorage) {
                    setImage(finalReceipt.id, imageDataForStorage);
                }
                onSaveSuccess();
            } catch (err) {
                const message = err instanceof Error ? err.message : null;
                setError(message || "Failed to save receipt. Please try again.");
            } finally {
                setIsSaving(false);
            }
            return;
        }

        if (imageDataForStorage) {
            setImage(finalReceipt.id, imageDataForStorage);
        }
        const pending = quickAdd(finalReceipt);
        resetForm();
        onSaveSuccess();
        setShowSaveToast({ state: 'pending', receiptId: finalReceipt.id });
        void pending.catch(() => {
            // Error handled within quickAdd via context state.
            if (imageDataForStorage) {
                removeImage(finalReceipt.id);
            }
            setShowSaveToast({ state: 'failed', receiptId: finalReceipt.id });
        });
    };

    const cancelEdit = () => {
        resetForm();
        setError(null);
        if (onCancel) {
            onCancel();
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
                <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                    <h2 className="text-2xl font-bold">
                        {isPresetMode
                            ? (isEditingPreset ? 'Edit Preset' : 'New Preset')
                            : initialData ? 'Edit Receipt' : 'New Receipt'}
                    </h2>
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
                    {isPresetMode && (
                        <Input
                            label="Preset name"
                            value={presetName}
                            onChange={e => {
                                setPresetName(e.target.value);
                                if (presetError) {
                                    setPresetError(null);
                                }
                            }}
                            placeholder="e.g. Monthly rent"
                            error={presetError ?? undefined}
                        />
                    )}
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
                        <Button
                            type="button"
                            fullWidth
                            onClick={() => {
                                if (isPresetMode) {
                                    handlePresetSave();
                                } else {
                                    void handleSave();
                                }
                            }}
                            disabled={!isPresetMode && isSaving}
                            className="shadow-lg shadow-primary/30"
                        >
                            <Save size={18} className="inline mr-2" />
                            {isPresetMode
                                ? 'Save Preset'
                                : isSaving
                                    ? 'Saving...'
                                    : initialData
                                        ? 'Update Receipt'
                                        : 'Save Receipt'}
                        </Button>
                    </div>
                </div>
                {showSaveToast && (
                    <div className="fixed bottom-4 inset-x-0 flex justify-center pointer-events-none">
                        <div className={`px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 pointer-events-auto ${showSaveToast.state === 'pending' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white'}`}>
                            {showSaveToast.state === 'pending' ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> Saving receipt…
                                </>
                            ) : (
                                <>
                                    <X size={16} /> Save failed. Check History to retry.
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Scanning / Landing View
    return (
        <div className="p-6 flex flex-col items-center justify-center min-h-[80vh] text-center">
            <h2 className="text-2xl font-bold mb-8">Add New Receipt</h2>
            
            {!imagePreview ? (
                <div className="w-full space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 border border-red-100 rounded-lg px-3 py-2 text-sm text-left">
                            {error}
                        </div>
                    )}
                    {presets.length > 0 && (
                        <div className="w-full text-left">
                            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Quick receipts</h3>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {presets.map(preset => (
                                    <div key={preset.id} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => void handleUsePreset(preset)}
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-left shadow-sm hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                                        >
                                            <div className="text-sm font-semibold text-slate-800 truncate">
                                                {preset.name}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                ${preset.totalAmount.toFixed(2)}
                                            </div>
                                        </button>
                                        <div className="absolute top-1.5 right-1.5 flex gap-1">
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handlePresetEdit(preset);
                                                }}
                                                className="rounded-full bg-white/90 p-1 text-slate-400 shadow hover:text-primary"
                                                aria-label={`Edit ${preset.name}`}
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handlePresetRemove(preset.id);
                                                }}
                                                className="rounded-full bg-white/90 p-1 text-slate-400 shadow hover:text-red-500"
                                                aria-label={`Remove ${preset.name}`}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
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
                        <Button
                            variant="secondary"
                            fullWidth
                            onClick={beginPresetCreate}
                            className="flex items-center justify-center gap-2"
                        >
                            <BookmarkPlus size={18} />
                            <span>Add preset</span>
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-sm">
                    <div className="rounded-xl overflow-hidden shadow-lg mb-6 border border-slate-200 relative">
                        <img src={imagePreview} alt="Preview" className="w-full max-h-[60vh] object-contain bg-black" />
                        <button 
                            onClick={() => { setImagePreview(null); setOptimizedImageData(null); setError(null); }}
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
