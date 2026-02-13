
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User } from '../types';
import { Button, Card } from '../components/UI';
import { Fingerprint } from '../components/Icons';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [hasStoredBiometrics, setHasStoredBiometrics] = useState(false);

  useEffect(() => {
    const checkBiometrics = async () => {
      const supported = !!(window.PublicKeyCredential && 
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
      setIsBiometricSupported(supported);
      
      const stored = localStorage.getItem('pizzastaff_biometric_enabled') === 'true';
      const storedPin = localStorage.getItem('pizzastaff_stored_pin');
      setHasStoredBiometrics(stored && !!storedPin);

      // Se supportato e già configurato, proviamo l'accesso automatico dopo un breve delay
      if (stored && storedPin) {
        setTimeout(() => handleBiometricLogin(storedPin), 500);
      }
    };
    checkBiometrics();
  }, []);

  const handleBiometricLogin = async (storedPin?: string) => {
    const pinToUse = storedPin || localStorage.getItem('pizzastaff_stored_pin');
    if (!pinToUse) return;

    try {
      // In un'app reale useremmo navigator.credentials.get() per una vera sfida FIDO2.
      // Qui simuliamo l'autenticazione del dispositivo.
      setLoading(true);
      const user = await db.getUserByPin(pinToUse);
      if (user) {
        onLogin(user);
      } else {
        localStorage.removeItem('pizzastaff_stored_pin');
        setHasStoredBiometrics(false);
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

  const renderNumpad = () => (
    <div className="w-full">
      <div className="flex justify-center gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${pin.length > i ? 'bg-[#007AFF] border-[#007AFF] scale-110' : 'bg-transparent border-[#C6C6C8]'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} onClick={() => { if(pin.length < 6) setPin(pin + d); setError(''); }} className="h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA]">{d}</button>
        ))}
        
        {/* Pulsante Biometria */}
        <button 
          onClick={() => isBiometricSupported ? handleBiometricLogin() : alert("La biometria non è abilitata o supportata su questo dispositivo.")}
          className={`h-16 rounded-full flex items-center justify-center transition-all ${hasStoredBiometrics ? 'text-[#007AFF] bg-white ios-shadow active:bg-[#E5E5EA]' : 'text-[#8E8E93] opacity-30'}`}
        >
          <Fingerprint size={32} />
        </button>

        <button onClick={() => { if(pin.length < 6) setPin(pin + '0'); setError(''); }} className="h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA]">0</button>
        
        <button onClick={handleLogin} disabled={pin.length < 4 || loading} className="h-16 rounded-full bg-[#007AFF] text-white text-sm font-bold shadow-md flex items-center justify-center">
          {loading ? <div className="loading-spinner border-white border-t-transparent" /> : 'OK'}
        </button>
      </div>
      <button onClick={() => setPin('')} className="w-full mt-4 h-10 text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest">
        Cancella PIN
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F2F2F7]">
      <div className="w-full max-sm flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 bg-white rounded-[24px] flex items-center justify-center shadow-xl p-0.5 overflow-hidden">
             <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" onError={e => (e.target as any).src = 'https://raw.githubusercontent.com/google/material-design-icons/master/png/maps/local_pizza/black/48dp/2x/local_pizza_black_48dp.png'} />
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-4">Pizza InTavola</h1>
          <p className="text-[#8E8E93] text-sm font-medium">Benvenuto, inserisci il tuo PIN</p>
        </div>

        <div className="w-full">
          {error && <p className="text-center text-sm font-bold mb-4 text-[#FF3B30]">{error}</p>}
          {renderNumpad()}
          <p className="text-center mt-10 text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest max-w-[240px] mx-auto leading-relaxed">
            Se è la tua prima volta o hai perso il PIN, contatta l'amministrazione.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
