
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User } from '../types';
import { Fingerprint, PizzaIcon } from '../components/Icons';
import { isBiometricAvailable, verifyBiometrics } from '../services/biometrics';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isBioSupported, setIsBioSupported] = useState(false);
  const [hasStoredPin, setHasStoredPin] = useState(false);

  useEffect(() => {
    const checkBio = async () => {
      const available = await isBiometricAvailable();
      setIsBioSupported(available);
      const enabled = localStorage.getItem('pizzastaff_biometric_enabled') === 'true';
      const stored = localStorage.getItem('pizzastaff_stored_pin');
      setHasStoredPin(enabled && !!stored);
      if (enabled && stored) handleBiometricLogin(stored);
    };
    checkBio();
  }, []);

  const handleBiometricLogin = async (storedPin?: string) => {
    const pinToUse = storedPin || localStorage.getItem('pizzastaff_stored_pin');
    if (!pinToUse) return;
    try {
      const verified = await verifyBiometrics("current_user");
      if (verified) {
        setLoading(true);
        const user = await db.getUserByPin(pinToUse);
        if (user) onLogin(user);
        else {
          localStorage.removeItem('pizzastaff_stored_pin');
          setHasStoredPin(false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setError('');
    try {
      const user = await db.getUserByPin(pin);
      if (user) onLogin(user);
      else {
        setError('PIN non valido');
        setPin('');
      }
    } catch (err) {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  const addDigit = (d: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + d);
      setError('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F2F2F7]">
      <div className="w-full max-w-lg flex flex-col items-center gap-12 sm:bg-white sm:p-12 sm:rounded-[48px] sm:shadow-2xl">
        <div className="flex flex-col items-center gap-6">
          <div className="w-28 h-28 bg-white rounded-[24%] flex items-center justify-center shadow-xl overflow-hidden relative group transition-transform hover:scale-105">
             <div className="absolute inset-0 bg-gradient-to-br from-[#FF9500] to-[#FF3B30]" />
             <PizzaIcon size={64} className="text-white relative z-10 drop-shadow-lg" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight text-[#1c1c1e]">Staff InTavola</h1>
            <p className="text-[#8E8E93] text-xs font-black uppercase tracking-[0.3em] mt-2">Accesso Personale</p>
          </div>
        </div>

        <div className="w-full max-w-[300px] flex flex-col items-center">
          {error && <p className="text-center text-sm font-black mb-8 text-[#FF3B30] animate-bounce">{error}</p>}
          
          <div className="flex justify-center gap-5 mb-12">
            {[...Array(4)].map((_, i) => (
              <div 
                key={i} 
                className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                  pin.length > i ? 'bg-[#007AFF] border-[#007AFF] scale-125 shadow-md' : 'bg-transparent border-[#C6C6C8]'
                }`} 
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-y-6 gap-x-8">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
              <button 
                key={d} 
                onClick={() => addDigit(d)} 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-3xl font-bold shadow-md active:bg-[#E5E5EA] active:scale-90 transition-all flex items-center justify-center mx-auto border border-[#F2F2F7]"
              >
                {d}
              </button>
            ))}
            
            <button 
              onClick={() => handleBiometricLogin()}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto transition-all ${
                hasStoredPin ? 'text-[#007AFF] bg-white shadow-md active:scale-90' : 'text-[#8E8E93] opacity-20'
              }`}
              disabled={!hasStoredPin}
            >
              <Fingerprint size={36} />
            </button>

            <button 
              onClick={() => addDigit('0')} 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-3xl font-bold shadow-md active:bg-[#E5E5EA] active:scale-90 transition-all flex items-center justify-center mx-auto border border-[#F2F2F7]"
            >
              0
            </button>
            
            <button 
              onClick={handleLogin} 
              disabled={pin.length < 4 || loading} 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#007AFF] text-white text-sm font-black shadow-lg flex items-center justify-center mx-auto active:scale-95 disabled:opacity-50 transition-all border-none"
            >
              {loading ? <div className="loading-spinner border-white border-t-transparent !w-6 !h-6" /> : 'ENTRA'}
            </button>
          </div>

          <button 
            onClick={() => setPin('')} 
            className="w-full mt-10 text-[11px] font-black text-[#8E8E93] uppercase tracking-[0.3em] hover:text-[#1c1c1e] transition-colors"
          >
            Cancella tutto
          </button>
        </div>
        
        <p className="text-center mt-6 text-[10px] font-bold text-[#C6C6C8] uppercase tracking-widest hidden sm:block">
          Il tuo codice è strettamente personale
        </p>
      </div>
    </div>
  );
};

export default Login;
