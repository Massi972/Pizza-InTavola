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
import { Fingerprint } from './components/Icons';
import { Button } from './components/UI';

// 2 secondi di tolleranza per evitare glitch tecnici, ma percepito come "sempre" dall'utente
const BACKGROUND_LOGOUT_THRESHOLD_MS = 2000; 

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem('pizzastaff_auth');
    return saved ? JSON.parse(saved) : { user: null, isAuthenticated: false };
  });

  const [view, setView] = useState<'dashboard' | 'pizzas' | 'users' | 'history' | 'modifications' | 'order' | 'calendar'>('dashboard');
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  const handleLogout = useCallback(() => {
    setAuth({ user: null, isAuthenticated: false });
    localStorage.removeItem('pizzastaff_auth');
    localStorage.removeItem('pizzastaff_last_background_at');
    // Non cancelliamo pizzastaff_passkey_active perché serve per il login rapido
    setView('dashboard');
  }, []);

  // --- SESSION GUARD GLOBALE ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // L'app è andata in background, segniamo il tempo
        localStorage.setItem('pizzastaff_last_background_at', Date.now().toString());
      } else if (document.visibilityState === 'visible') {
        // L'utente sta riaprendo l'app
        const lastBg = localStorage.getItem('pizzastaff_last_background_at');
        if (lastBg && auth.isAuthenticated) {
          const elapsed = Date.now() - parseInt(lastBg);
          if (elapsed >= BACKGROUND_LOGOUT_THRESHOLD_MS) {
            handleLogout();
          }
        }
        // Puliamo il timestamp per evitare logout doppi
        localStorage.removeItem('pizzastaff_last_background_at');
      }
    };

    // Gestione chiusura tab o browser
    const handlePageHide = () => {
      if (auth.isAuthenticated) {
        localStorage.setItem('pizzastaff_last_background_at', Date.now().toString());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [auth.isAuthenticated, handleLogout]);

  useEffect(() => {
    if (auth.isAuthenticated) {
      localStorage.setItem('pizzastaff_auth', JSON.stringify(auth));
    }
    
    const checkSupport = async () => {
      const supported = !!(window.PublicKeyCredential && 
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
      setIsBiometricSupported(supported);
    };
    checkSupport();
  }, [auth]);

  const handleLogin = (user: User) => {
    setAuth({ user, isAuthenticated: true });
    
    const passkeyActive = localStorage.getItem('pizzastaff_passkey_active') === 'true';
    const hasDeclined = localStorage.getItem('pizzastaff_passkey_declined') === 'true';

    if (!passkeyActive && !hasDeclined && isBiometricSupported) {
      setTimeout(() => setShowPasskeyPrompt(true), 1500);
    }
  };

  const declinePasskey = () => {
    localStorage.setItem('pizzastaff_passkey_declined', 'true');
    setShowPasskeyPrompt(false);
  };

  if (!auth.isAuthenticated || !auth.user) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="bg-[#F2F2F7] h-full overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {view === 'pizzas' && <AdminPizzas onBack={() => setView('dashboard')} />}
        {view === 'users' && <AdminUsers currentUser={auth.user} onBack={() => setView('dashboard')} />}
        {view === 'history' && <AdminHistory onBack={() => setView('dashboard')} />}
        {view === 'modifications' && <AdminModifications onBack={() => setView('dashboard')} />}
        {view === 'calendar' && <AdminCalendar onBack={() => setView('dashboard')} />}
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

      {showPasskeyPrompt && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={declinePasskey} />
          <div className="relative bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom duration-500 text-center space-y-6">
            <div className="w-20 h-20 bg-[#F2F2F7] text-[#007AFF] rounded-full flex items-center justify-center mx-auto">
              <Fingerprint size={40} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1c1c1e]">Accesso Biometrico</h3>
              <p className="text-sm text-[#8E8E93] mt-2 leading-relaxed">
                Vuoi attivare il Face ID o l'impronta digitale? Potrai entrare istantaneamente senza PIN la prossima volta.
              </p>
            </div>
            <div className="space-y-3">
              <Button fullWidth onClick={() => { setShowPasskeyPrompt(false); setView('order'); }}>Configura nel profilo</Button>
              <button 
                onClick={declinePasskey}
                className="w-full py-2 text-sm font-bold text-[#8E8E93] uppercase tracking-widest"
              >
                No, grazie
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;