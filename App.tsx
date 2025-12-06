import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { ViewState, Receipt } from './types';
import { Dashboard } from './components/Dashboard';
import { ReceiptScanner } from './components/ReceiptScanner';
import { Converter } from './components/Converter';
import { History } from './components/History';
import { useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { Loader2 } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading your workspace…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const handleScanSuccess = () => {
    setEditingReceipt(null);
    setCurrentView(ViewState.HISTORY);
  };

  const handleViewDetails = (id: string) => {
      // Logic to jump to history view
      setCurrentView(ViewState.HISTORY);
  };

  const handleEditReceipt = (receipt: Receipt) => {
    setEditingReceipt(receipt);
    setCurrentView(ViewState.SCAN);
  };

  const handleCancelEdit = () => {
    setEditingReceipt(null);
    // If we were editing, go back to history, otherwise just stay (or could go dashboard)
    if (editingReceipt) {
        setCurrentView(ViewState.HISTORY);
    }
  }

  const renderView = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return <Dashboard onViewDetails={handleViewDetails} />;
      case ViewState.SCAN:
        return (
            <ReceiptScanner 
                initialData={editingReceipt} 
                onSaveSuccess={handleScanSuccess}
                onCancel={handleCancelEdit}
            />
        );
      case ViewState.CONVERTER:
        return <Converter />;
      case ViewState.HISTORY:
        return <History onEdit={handleEditReceipt} />;
      default:
        return <Dashboard onViewDetails={handleViewDetails} />;
    }
  };

  return (
    <Layout currentView={currentView} setView={setCurrentView}>
      {renderView()}
    </Layout>
  );
}