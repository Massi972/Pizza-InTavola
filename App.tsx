import React, { useState, useEffect, useCallback } from 'react';
import { AuthState, User, Role } from './types';
import { db } from './services/db';
import LoginView from './views/Login';
import WorkerDashboard from './views/WorkerDashboard';
import AdminDashboard from './views/AdminDashboard';
import AdminPizzas from './views/AdminPizzas';
import AdminUsers from './views/AdminUsers';
import AdminHistory from './views/AdminHistory';
import AdminModifications from './views/AdminModifications';
import AdminCalendar from './views/AdminCalendar';
import AdminFlags from './views/AdminFlags';
import { Button } from './components/UI';
import { Sun, Moon } from './components/Icons';

// Soglia zero: sicurezza massima, nessun tempo di tolleranza.
const BACKGROUND_LOGOUT_THRESHOLD_MS = 0; 

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(() => {
    // Usiamo sessionStorage per far sì che la sessione muoia con la chiusura del processo/tab
    const saved = sessionStorage.getItem('pizzastaff_auth');
    return saved ? JSON.parse(saved) : { user: null, isAuthenticated: false };
  });

  const [view, setView] = useState<'dashboard' | 'pizzas' | 'users' | 'history' | 'modifications' | 'order' | 'calendar' | 'flags'>('dashboard');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('pizzastaff_darkmode') === 'true');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('pizzastaff_darkmode', darkMode.toString());
  }, [darkMode]);

  const handleLogout = useCallback(() => {
    setAuth({ user: null, isAuthenticated: false });
    sessionStorage.removeItem('pizzastaff_auth');
    localStorage.removeItem('pizzastaff_last_background_at');
    setView('dashboard');
  }, []);

  // --- SICUREZZA TOTALE: Logout immediato al cambio visibilità ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Se l'app non è più visibile (chiusa, swipe, cambio app, lock screen)
      if (document.visibilityState === 'hidden') {
        handleLogout();
      }
    };

    // Gestione specifica per la chiusura forzata o swipe away su iOS/Android
    const handlePageHide = () => {
      handleLogout();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [handleLogout]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      sessionStorage.setItem('pizzastaff_auth', JSON.stringify(auth));
    }
  }, [auth]);

  const handleLogin = (user: User) => {
    setAuth({ user, isAuthenticated: true });
  };

  if (!auth.isAuthenticated || !auth.user) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className={`h-full overflow-hidden flex flex-col ${darkMode ? 'dark text-white' : ''}`}>
      <div className="flex-1 overflow-y-auto bg-[#F2F2F7] dark:bg-black">
        {/* Toggle Dark Mode Floating */}
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="fixed bottom-6 right-6 z-[60] w-12 h-12 rounded-full shadow-2xl flex items-center justify-center bg-white dark:bg-[#1c1c1e] text-black dark:text-white border border-[#C6C6C8] dark:border-[#38383a] active:scale-95 transition-all"
        >
          {darkMode ? <Sun size={20} className="text-[#FFD60A]" /> : <Moon size={20} className="text-[#5856D6]" />}
        </button>

        {view === 'pizzas' ? <AdminPizzas onBack={() => setView('dashboard')} /> :
         view === 'users' ? <AdminUsers currentUser={auth.user} onBack={() => setView('dashboard')} /> :
         view === 'history' ? <AdminHistory onBack={() => setView('dashboard')} /> :
         view === 'modifications' ? <AdminModifications onBack={() => setView('dashboard')} /> :
         view === 'calendar' ? <AdminCalendar onBack={() => setView('dashboard')} /> :
         view === 'flags' ? <AdminFlags onBack={() => setView('dashboard')} /> :
         view === 'order' || auth.user.role === Role.WORKER ? (
           <WorkerDashboard 
             user={auth.user} 
             onLogout={handleLogout} 
             onBackToAdmin={auth.user.role !== Role.WORKER ? () => setView('dashboard') : undefined} 
           />
         ) : (
           <AdminDashboard 
             user={auth.user} 
             onLogout={handleLogout} 
             onNavigate={(v: any) => setView(v)} 
             onGoToOrder={() => setView('order')}
           />
         )}
      </div>
    </div>
  );
};

export default App;