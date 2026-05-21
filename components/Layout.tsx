import React from 'react';
import { LogOut, ChevronLeft } from './Icons';
import { Role } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  role?: Role;
  onLogout?: () => void;
  onBack?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, onLogout, onBack }) => {
  return (
    <div className="min-h-full flex flex-col w-full max-w-lg mx-auto bg-[#F2F2F7] relative">
      <header className="sticky top-0 z-40 ios-blur border-b border-[#C6C6C8] px-4 pb-3 safe-header-padding flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 text-[#007AFF] active:opacity-40 transition-opacity shrink-0">
              <ChevronLeft size={24} />
            </button>
          )}
          <h1 className="text-lg font-bold tracking-tight text-[#1c1c1e] truncate">{title}</h1>
        </div>
        {onLogout && (
          <button 
            onClick={onLogout}
            className="p-2 -mr-2 text-[#FF3B30] active:opacity-40 transition-opacity shrink-0"
          >
            <LogOut size={20} />
          </button>
        )}
      </header>
      
      <main className="flex-1 p-4 pb-[calc(100px+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
};