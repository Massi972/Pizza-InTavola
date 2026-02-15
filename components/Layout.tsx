
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
    <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-[#F2F2F7]">
      <header className="sticky top-0 z-40 ios-blur border-b border-[#C6C6C8] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="p-1 -ml-1 text-[#007AFF]">
              <ChevronLeft size={24} />
            </button>
          )}
          <h1 className="text-lg font-bold tracking-tight">{title}</h1>
        </div>
        {onLogout && (
          <button 
            onClick={onLogout}
            className="p-2 text-[#FF3B30] active:opacity-60 transition-opacity"
          >
            <LogOut size={20} />
          </button>
        )}
      </header>
      <main className="flex-1 p-4 pb-24">
        {children}
      </main>
    </div>
  );
};
