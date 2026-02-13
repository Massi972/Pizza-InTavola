
import React, { useState } from 'react';
import { db } from '../services/db';
import { User } from '../types';
import { Button, Card } from '../components/UI';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        <button onClick={() => setPin('')} className="h-16 rounded-full text-xs font-bold text-[#FF3B30]">CANCELLA</button>
        <button onClick={() => { if(pin.length < 6) setPin(pin + '0'); setError(''); }} className="h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA]">0</button>
        <button onClick={handleLogin} disabled={pin.length < 4 || loading} className="h-16 rounded-full bg-[#007AFF] text-white text-sm font-bold shadow-md flex items-center justify-center">
          {loading ? <div className="loading-spinner border-white border-t-transparent" /> : 'OK'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F2F2F7]">
      <div className="w-full max-sm flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl p-0.5 overflow-hidden">
             <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" onError={e => (e.target as any).src = 'https://raw.githubusercontent.com/google/material-design-icons/master/png/maps/local_pizza/black/48dp/2x/local_pizza_black_48dp.png'} />
          </div>
          <h1 className="text-3xl font-black tracking-tighter mt-4">Pizza InTavola</h1>
          <p className="text-[#8E8E93] text-sm font-medium">Inserisci PIN personale</p>
        </div>

        <div className="w-full">
          {error && <p className="text-center text-sm font-bold mb-4 text-red-500">{error}</p>}
          {renderNumpad()}
          <p className="text-center mt-8 text-xs text-[#8E8E93] max-w-[200px] mx-auto">
            Se hai dimenticato il PIN, chiedi all'amministratore del locale.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
