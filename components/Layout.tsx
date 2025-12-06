import React from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, ScanLine, Calculator, History } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, setView }) => {
  const navItems = [
    { view: ViewState.DASHBOARD, label: 'Dash', icon: LayoutDashboard },
    { view: ViewState.SCAN, label: 'Scan', icon: ScanLine },
    { view: ViewState.CONVERTER, label: 'Convert', icon: Calculator },
    { view: ViewState.HISTORY, label: 'History', icon: History },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar">
        <div className="mx-auto w-full max-w-2xl bg-white pb-24 shadow-xl">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="safe-area-pb sticky bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white pb-1 shadow-[0_-6px_18px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex max-w-2xl justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={`flex flex-col items-center justify-center py-3 w-full transition-colors ${
                  isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};