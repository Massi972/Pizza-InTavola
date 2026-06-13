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
import AdminNotifications from './views/AdminNotifications';
import RegisterView from './views/Register';
import { Button } from './components/UI';
import { LanguageProvider } from './services/i18n';
import { subscribeToPush, registerServiceWorker } from './services/pushNotifications';

// Soglia zero: sicurezza massima, nessun tempo di tolleranza.
const BACKGROUND_LOGOUT_THRESHOLD_MS = 0; 

const AppContent: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(() => {
    // Usiamo sessionStorage per far sì che la sessione muoia con la chiusura del processo/tab
    const saved = sessionStorage.getItem('pizzastaff_auth');
    return saved ? JSON.parse(saved) : { user: null, isAuthenticated: false };
  });

  const [view, setView] = useState<'dashboard' | 'pizzas' | 'users' | 'history' | 'modifications' | 'order' | 'calendar' | 'flags' | 'notifications'>('dashboard');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleLogout = useCallback(() => {
    setAuth({ user: null, isAuthenticated: false });
    sessionStorage.removeItem('pizzastaff_auth');
    localStorage.removeItem('pizzastaff_last_background_at');
    setView('dashboard');
    setIsRegistering(false);
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
    setIsRegistering(false);
    // Registra il SW e richiede permesso notifiche dopo il login
    setTimeout(() => {
      registerServiceWorker().then(() => {
        subscribeToPush(user.id).catch(console.error);
      });
    }, 2000);
  };

  if (!auth.isAuthenticated || !auth.user) {
    if (isRegistering) {
      return <RegisterView onBack={() => setIsRegistering(false)} onSuccess={handleLogin} />;
    }
    return <LoginView onLogin={handleLogin} onRegister={() => setIsRegistering(true)} />;
  }

  return (
    <div className="bg-[#F2F2F7] h-full overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {view === 'pizzas' && <AdminPizzas onBack={() => setView('dashboard')} />}
        {view === 'users' && <AdminUsers currentUser={auth.user} onBack={() => setView('dashboard')} />}
        {view === 'history' && <AdminHistory onBack={() => setView('dashboard')} />}
        {view === 'modifications' && <AdminModifications onBack={() => setView('dashboard')} />}
        {view === 'calendar' && <AdminCalendar onBack={() => setView('dashboard')} />}
        {view === 'flags' && <AdminFlags onBack={() => setView('dashboard')} />}
        {view === 'notifications' && <AdminNotifications onBack={() => setView('dashboard')} />}
        {view === 'order' && <WorkerDashboard user={auth.user} onLogout={handleLogout} onBackToAdmin={() => setView('dashboard')} />}
        {view === 'dashboard' && auth.user.role !== Role.WORKER && (
          <AdminDashboard 
            user={auth.user} 
            onLogout={handleLogout} 
            onNavigate={(v: any) => setView(v)} 
            onGoToOrder={() => setView('order')}
          />
        )}
        {auth.user.role === Role.WORKER && (
          <WorkerDashboard user={auth.user} onLogout={handleLogout} />
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;