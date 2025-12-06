import React, { useState } from 'react';
import { LayoutDashboard, ScanLine, Calculator, History, LogOut, UserCircle } from 'lucide-react';
import { ViewState } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, setView }) => {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navItems = [
    { view: ViewState.DASHBOARD, label: 'Dash', icon: LayoutDashboard },
    { view: ViewState.SCAN, label: 'Scan', icon: ScanLine },
    { view: ViewState.CONVERTER, label: 'Convert', icon: Calculator },
    { view: ViewState.HISTORY, label: 'History', icon: History },
  ];

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar">
        <div className="mx-auto w-full max-w-2xl bg-white pb-24 shadow-xl">
          {user && (
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-3 text-slate-600">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <UserCircle size={24} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Signed in as</p>
                  <p className="text-sm font-semibold text-slate-700">{user.username}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="flex items-center gap-2 text-slate-500 hover:text-slate-700"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
              >
                <LogOut size={16} />
                {isLoggingOut ? 'Logging out…' : 'Log out'}
              </Button>
            </header>
          )}
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