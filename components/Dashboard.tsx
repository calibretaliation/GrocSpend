import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import { getReceipts } from '../services/storageService';
import { Receipt } from '../types';
import { CATEGORIES } from '../constants';

const COLORS = ['#0ea5e9', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

export const Dashboard: React.FC<{ onViewDetails: (id: string) => void }> = ({ onViewDetails }) => {
  const receipts = useMemo(() => getReceipts(), []);

  // Filter for current month
  const currentMonthReceipts = useMemo(() => {
    const now = new Date();
    return receipts.filter(r => {
        const d = new Date(r.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [receipts]);

  // Pie Chart Data: Expenses by Category
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    currentMonthReceipts.forEach(r => {
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
  }, [currentMonthReceipts]);

  // Bar Chart Data: Daily Spending (Last 7 days)
  const barData = useMemo(() => {
     const data = [];
     const now = new Date();
     for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const displayDate = `${d.getMonth() + 1}/${d.getDate()}`;
        
        const dayTotal = receipts
            .filter(r => r.date === dateStr)
            .reduce((sum, r) => sum + r.totalAmount, 0);
        
        data.push({
            name: displayDate,
            amount: dayTotal
        });
     }
     return data;
  }, [receipts]);

  const totalSpentThisMonth = currentMonthReceipts.reduce((sum, r) => sum + r.totalAmount, 0);

  return (
    <div className="flex flex-col h-full">
        {/* Upper Fold (Charts) - Fixed Height approx 40% */}
        <div className="bg-white p-4 pb-2 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-2">This Month: ${totalSpentThisMonth.toFixed(2)}</h2>
            
            <div className="flex flex-row h-48">
                {/* Pie Chart */}
                <div className="flex-1 relative">
                    <h3 className="text-xs text-slate-500 font-semibold absolute top-0 left-0">By Category</h3>
                    {pieData.length > 0 ? (
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
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                    <h3 className="text-xs text-slate-500 font-semibold absolute top-0 left-2">Last 7 Days</h3>
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData}>
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                            <Bar dataKey="amount" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Lower Fold (List) - Scrollable */}
        <div className="flex-1 bg-slate-50 overflow-hidden flex flex-col">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Recent Transactions</h3>
            <div className="overflow-y-auto flex-1 px-4 pb-20 no-scrollbar space-y-3">
                {currentMonthReceipts.length === 0 ? (
                    <div className="text-center text-slate-400 py-10">No transactions this month.</div>
                ) : (
                    currentMonthReceipts.sort((a,b) => b.createdAt - a.createdAt).map(receipt => (
                        <div 
                            key={receipt.id} 
                            onClick={() => onViewDetails(receipt.id)}
                            className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 flex justify-between items-center active:bg-slate-50"
                        >
                            <div className="flex-1">
                                <p className="font-semibold text-slate-800">{receipt.merchant}</p>
                                <p className="text-xs text-slate-500">
                                    {new Date(receipt.date).toLocaleDateString()} • {receipt.paymentSource}
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