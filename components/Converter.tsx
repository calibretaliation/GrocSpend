import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Settings } from 'lucide-react';
import { Input } from './Input';
import { DEFAULT_EXCHANGE_RATE, UNITS } from '../constants';
import { Button } from './Button';

export const Converter: React.FC = () => {
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE.usdToVnd);
  const [price, setPrice] = useState<string>('');
  const [unit, setUnit] = useState<string>('lb');
  const [showSettings, setShowSettings] = useState(false);

  // Conversion Logic
  const getVndPerKg = () => {
    const p = parseFloat(price);
    if (isNaN(p) || p === 0) return 0;

    // Price (VND/kg) = (Price (USD/lb) * Rate) / 0.453592
    // Generalizing: 1 lb = 0.453592 kg
    // 1 oz = 0.0283495 kg
    
    let kgFactor = 1; // Default for 'kg' or 'each' (no weight conversion usually intended for 'each' but logic follows)
    
    if (unit === 'lb') kgFactor = 0.453592;
    if (unit === 'oz') kgFactor = 0.0283495;
    if (unit === 'g') kgFactor = 0.001;
    
    // If unit is 'each', 'box', 'pkg', the "per kg" metric might not make sense, 
    // but we can still show the absolute converted price.
    const isWeight = ['lb', 'kg', 'oz', 'g'].includes(unit);

    if (isWeight) {
        // Price per Unit (USD) * Rate = Price per Unit (VND)
        // Price per Unit (VND) / kgFactor = Price per Kg (VND)
        return (p * exchangeRate) / kgFactor;
    }
    return 0;
  };

  const getTotalVnd = () => {
    const p = parseFloat(price);
    if (isNaN(p)) return 0;
    return p * exchangeRate;
  };

  const vndPerKg = getVndPerKg();
  const totalVnd = getTotalVnd();

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Converter</h2>
        <button onClick={() => setShowSettings(!showSettings)} className="text-slate-500 hover:text-primary">
            <Settings size={24} />
        </button>
      </div>

      {showSettings && (
        <div className="mb-6 p-4 bg-slate-100 rounded-lg animate-in fade-in slide-in-from-top-2">
            <h3 className="font-semibold mb-2 text-sm text-slate-600">Configuration</h3>
            <Input 
                label="Exchange Rate (1 USD = ? VND)"
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
            />
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <label className="block text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">Input (USD)</label>
            <div className="flex gap-4 items-end">
                <div className="flex-1">
                    <Input 
                        label="Price"
                        type="number"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="text-lg font-mono"
                        inputMode="decimal"
                    />
                </div>
                <div className="w-1/3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                    <select 
                        value={unit} 
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-primary focus:outline-none h-[42px]"
                    >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>
            </div>
        </div>

        <div className="flex justify-center text-slate-300">
            <ArrowRightLeft size={32} />
        </div>

        <div className="bg-primary/5 p-6 rounded-xl border border-primary/20">
             <label className="block text-sm font-semibold text-primary mb-4 uppercase tracking-wider">Result (VND)</label>
             
             <div className="space-y-4">
                <div>
                    <p className="text-sm text-slate-500 mb-1">Equivalent Price</p>
                    <p className="text-3xl font-bold text-slate-800 font-mono">
                        {totalVnd.toLocaleString('vi-VN')} ₫
                        <span className="text-sm text-slate-400 font-normal ml-2">/{unit}</span>
                    </p>
                </div>

                {vndPerKg > 0 && (
                    <div className="pt-4 border-t border-primary/10">
                        <p className="text-sm text-slate-500 mb-1">Price per Kilogram</p>
                        <p className="text-2xl font-bold text-primary font-mono">
                            {vndPerKg.toLocaleString('vi-VN')} ₫
                            <span className="text-sm text-slate-400 font-normal ml-2">/kg</span>
                        </p>
                    </div>
                )}
             </div>
        </div>
      </div>
    </div>
  );
};