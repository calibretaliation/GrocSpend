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
    <div className="flex flex-col h-full bg-slate-50">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative">
        <div className="max-w-2xl mx-auto h-full bg-white shadow-xl min-h-screen">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-slate-200 safe-area-pb z-50">
        <div className="max-w-2xl mx-auto flex justify-around">
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