
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

      if (enabled && stored) {
        handleBiometricLogin(stored);
      }
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
        if (user) {
          onLogin(user);
        } else {
          localStorage.removeItem('pizzastaff_stored_pin');
          setHasStoredPin(false);
        }
      }
    } catch (err) {
      console.error("Biometric error", err);
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
      if (user) {
        onLogin(user);
      } else {
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
      const newPin = pin + d;
      setPin(newPin);
      setError('');
    }
  };

  const renderNumpad = () => (
    <div className="w-full max-w-[280px]">
      <div className="flex justify-center gap-4 mb-10">
        {[...Array(4)].map((_, i) => (
          <div 
            key={i} 
            className={`w-3 h-3 rounded-full border-2 transition-all duration-200 ${
              pin.length > i ? 'bg-[#007AFF] border-[#007AFF] scale-125' : 'bg-transparent border-[#C6C6C8]'
            }`} 
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-y-4 gap-x-6">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button 
            key={d} 
            onClick={() => addDigit(d)} 
            className="w-16 h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA] transition-colors flex items-center justify-center mx-auto"
          >
            {d}
          </button>
        ))}
        
        <button 
          onClick={() => handleBiometricLogin()}
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-all ${
            hasStoredPin ? 'text-[#007AFF] bg-white ios-shadow active:bg-[#E5E5EA]' : 'text-[#8E8E93] opacity-20'
          }`}
          disabled={!hasStoredPin}
        >
          <Fingerprint size={32} />
        </button>

        <button 
          onClick={() => addDigit('0')} 
          className="w-16 h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA] flex items-center justify-center mx-auto"
        >
          0
        </button>
        
        <button 
          onClick={handleLogin} 
          disabled={pin.length < 4 || loading} 
          className="w-16 h-16 rounded-full bg-[#007AFF] text-white text-sm font-black shadow-lg flex items-center justify-center mx-auto active:scale-95 disabled:opacity-50 transition-all"
        >
          {loading ? <div className="loading-spinner border-white border-t-transparent" /> : 'ENTRA'}
        </button>
      </div>
      <button 
        onClick={() => setPin('')} 
        className="w-full mt-8 text-[10px] font-black text-[#8E8E93] uppercase tracking-[0.2em]"
      >
        Cancella
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F2F2F7]">
      <div className="w-full max-w-xs flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-6">
          {/* Logo astratto senza l'immagine esterna */}
          <div className="w-24 h-24 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-[22%] flex items-center justify-center shadow-2xl relative">
             <PizzaIcon size={48} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tighter text-[#1c1c1e]">InTavola Staff</h1>
            <p className="text-[#8E8E93] text-[10px] font-black uppercase tracking-[0.3em] mt-1">Area Riservata Dipendenti</p>
          </div>
        </div>

        <div className="w-full flex flex-col items-center">
          {error && <p className="text-center text-sm font-bold mb-6 text-[#FF3B30] animate-bounce">{error}</p>}
          {renderNumpad()}
          <p className="text-center mt-12 text-[9px] font-bold text-[#C6C6C8] uppercase tracking-[0.1em] max-w-[200px] leading-relaxed">
            Accedi con il tuo PIN per ordinare la pizza di oggi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
