
import React, { useState, useEffect } from 'react';
import { AuthState, User, Role } from './types';
import { db } from './services/db';
import LoginView from './views/Login';
import WorkerDashboard from './views/WorkerDashboard';
import AdminDashboard from './views/AdminDashboard';
import AdminPizzas from './views/AdminPizzas';
import AdminUsers from './views/AdminUsers';
import AdminHistory from './views/AdminHistory';
import AdminModifications from './views/AdminModifications';
import { Fingerprint, X } from './components/Icons';
import { Button } from './components/UI';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem('pizzastaff_auth');
    return saved ? JSON.parse(saved) : { user: null, isAuthenticated: false };
  });

  const [view, setView] = useState<'dashboard' | 'pizzas' | 'users' | 'history' | 'modifications'>('dashboard');
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  useEffect(() => {
    localStorage.setItem('pizzastaff_auth', JSON.stringify(auth));
    
    const checkSupport = async () => {
      const supported = !!(window.PublicKeyCredential && 
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
      setIsBiometricSupported(supported);
    };
    checkSupport();
  }, [auth]);

  const handleLogin = (user: User) => {
    setAuth({ user, isAuthenticated: true });
    
    const biometricEnabled = localStorage.getItem('pizzastaff_biometric_enabled') === 'true';
    const hasDeclined = localStorage.getItem('pizzastaff_biometric_declined') === 'true';

    if (!biometricEnabled && !hasDeclined && window.PublicKeyCredential) {
      setTimeout(() => setShowBiometricPrompt(true), 1500);
    }
  };

  const handleLogout = () => {
    setAuth({ user: null, isAuthenticated: false });
    setView('dashboard');
  };

  const enableBiometrics = () => {
    if (auth.user?.pin) {
      localStorage.setItem('pizzastaff_stored_pin', auth.user.pin);
      localStorage.setItem('pizzastaff_biometric_enabled', 'true');
      localStorage.removeItem('pizzastaff_biometric_declined');
      setShowBiometricPrompt(false);
    }
  };

  const declineBiometrics = () => {
    localStorage.setItem('pizzastaff_biometric_declined', 'true');
    setShowBiometricPrompt(false);
  };

  if (!auth.isAuthenticated || !auth.user) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="bg-[#F2F2F7] min-h-screen">
      {auth.user?.role === Role.ADMIN || auth.user?.role === Role.SUPERVISOR ? (
        <>
          {view === 'pizzas' && <AdminPizzas onBack={() => setView('dashboard')} />}
          {view === 'users' && <AdminUsers onBack={() => setView('dashboard')} />}
          {view === 'history' && <AdminHistory onBack={() => setView('dashboard')} />}
          {view === 'modifications' && <AdminModifications onBack={() => setView('dashboard')} />}
          {view === 'dashboard' && <AdminDashboard user={auth.user!} onLogout={handleLogout} onNavigate={(v: any) => setView(v)} />}
        </>
      ) : (
        <WorkerDashboard user={auth.user!} onLogout={handleLogout} />
      )}

      {showBiometricPrompt && isBiometricSupported && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={declineBiometrics} />
          <div className="relative bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom duration-500 text-center space-y-6">
            <div className="w-20 h-20 bg-[#F2F2F7] text-[#007AFF] rounded-full flex items-center justify-center mx-auto">
              <Fingerprint size={40} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1c1c1e]">Accesso Rapido</h3>
              <p className="text-sm text-[#8E8E93] mt-2 leading-relaxed">
                Vuoi attivare il Face ID o l'impronta digitale per accedere più velocemente la prossima volta?
              </p>
            </div>
            <div className="space-y-3">
              <Button fullWidth onClick={enableBiometrics}>Attiva Ora</Button>
              <button 
                onClick={declineBiometrics}
                className="w-full py-2 text-sm font-bold text-[#8E8E93] uppercase tracking-widest"
              >
                Magari più tardi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
