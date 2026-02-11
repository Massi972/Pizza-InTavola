
import React, { useState } from 'react';
import { db } from '../services/db';
import { User } from '../types';
import { Button, Input, Card } from '../components/UI';
import { PizzaIcon, Lock } from '../components/Icons';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length < 4) return;
    
    setLoading(true);
    setError('');
    
    try {
      const user = await db.getUserByPin(pin);
      if (user) {
        onLogin(user);
      } else {
        setError('PIN non valido o utente disattivato');
        setPin('');
      }
    } catch (err) {
      setError('Errore di connessione al server');
    } finally {
      setLoading(false);
    }
  };

  const appendPin = (digit: string) => {
    if (pin.length < 6) setPin(prev => prev + digit);
  };

  const clearPin = () => setPin('');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F2F2F7]">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 bg-[#007AFF] rounded-3xl flex items-center justify-center shadow-lg transform -rotate-3">
            <PizzaIcon color="white" size={40} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-4">Staff Pizza</h1>
          <p className="text-[#8E8E93] font-medium text-center px-4">Inserisci il tuo codice personale per accedere</p>
        </div>

        <div className="w-full">
          <div className="flex justify-center gap-4 mb-8">
            {[1, 2, 3, 4].map((_, i) => (
              <div 
                key={i} 
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  pin.length > i ? 'bg-[#007AFF] border-[#007AFF] scale-110' : 'bg-transparent border-[#C6C6C8]'
                }`}
              />
            ))}
          </div>

          <div className="h-6 mb-2">
            {error && <p className="text-[#FF3B30] text-center text-sm font-medium animate-bounce">{error}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
              <button
                key={d}
                disabled={loading}
                onClick={() => { setError(''); appendPin(d); }}
                className="h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA] transition-colors disabled:opacity-50"
              >
                {d}
              </button>
            ))}
            <button 
              disabled={loading}
              onClick={clearPin} 
              className="h-16 rounded-full text-sm font-semibold text-[#FF3B30] disabled:opacity-50"
            >
              CANCELLA
            </button>
            <button
              disabled={loading}
              onClick={() => { setError(''); appendPin('0'); }}
              className="h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA] transition-colors disabled:opacity-50"
            >
              0
            </button>
            <button 
              onClick={() => handleLogin()}
              disabled={pin.length < 4 || loading}
              className="h-16 rounded-full bg-[#007AFF] text-white text-sm font-bold shadow-md active:opacity-80 transition-opacity disabled:opacity-40 flex items-center justify-center"
            >
              {loading ? <div className="loading-spinner border-white border-t-transparent" /> : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
