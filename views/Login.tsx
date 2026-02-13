
import React, { useState } from 'react';
import { db } from '../services/db';
import { User, Role } from '../types';
import { Button, Input, Card } from '../components/UI';
import { ChevronRight, X, AlertCircle, Check } from '../components/Icons';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'pin' | 'reset-search' | 'reset-verify' | 'reset-new-pin'>('pin');
  
  const [showRecover, setShowRecover] = useState(false);
  const [managerPhone, setManagerPhone] = useState('');
  const [workerUsers, setWorkerUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [masterCodeInput, setMasterCodeInput] = useState('');
  const [newPin, setNewPin] = useState('');

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

  const openRecoverModal = async () => {
    const settings = await db.getSettings();
    setManagerPhone(settings.manager_phone || '');
    setShowRecover(true);
  };

  const handleWhatsAppHelp = (userName: string = "") => {
    const msg = userName 
      ? `Ciao, sono ${userName}, ho dimenticato il mio PIN per ordinare la pizza.`
      : `Ciao, ho dimenticato il mio PIN per ordinare la pizza.`;
    window.open(`https://wa.me/${managerPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const startReset = async () => {
    setLoading(true);
    try {
      const users = await db.getUsers();
      setWorkerUsers(users.filter(u => u.active && u.role === Role.WORKER));
      setMode('reset-search');
    } catch (err) {
      setError('Errore nel recupero utenti');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMasterCode = async () => {
    setLoading(true);
    try {
      const actualCode = await db.getMasterCode();
      if (masterCodeInput.toUpperCase() === actualCode.toUpperCase()) {
        setMode('reset-new-pin');
      } else {
        setError('Codice Locale errato');
      }
    } catch (err) {
      setError('Errore verifica');
    } finally {
      setLoading(false);
    }
  };

  const renderNumpad = (value: string, setValue: (v: string) => void, onConfirm: () => void) => (
    <div className="w-full">
      <div className="flex justify-center gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${value.length > i ? 'bg-[#007AFF] border-[#007AFF] scale-110' : 'bg-transparent border-[#C6C6C8]'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} onClick={() => { if(value.length < 6) setValue(value + d); setError(''); }} className="h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA]">{d}</button>
        ))}
        <button onClick={() => setValue('')} className="h-16 rounded-full text-xs font-bold text-[#FF3B30]">CANCELLA</button>
        <button onClick={() => { if(value.length < 6) setValue(value + '0'); setError(''); }} className="h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA]">0</button>
        <button onClick={onConfirm} disabled={value.length < 4 || loading} className="h-16 rounded-full bg-[#007AFF] text-white text-sm font-bold shadow-md flex items-center justify-center">
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
          <p className="text-[#8E8E93] text-sm font-medium">
            {mode === 'pin' ? 'Inserisci PIN personale' : 'Procedura di Reset'}
          </p>
        </div>

        <div className="w-full">
          {error && <p className={`text-center text-sm font-bold mb-4 ${error.includes('aggiornato') ? 'text-green-500' : 'text-red-500'}`}>{error}</p>}

          {mode === 'pin' && (
            <div className="flex flex-col gap-4">
              {renderNumpad(pin, setPin, handleLogin)}
              <div className="flex flex-col gap-3 mt-4">
                <button onClick={openRecoverModal} className="text-[#007AFF] font-bold text-sm">Hai dimenticato il PIN?</button>
                <button onClick={startReset} className="text-[#8E8E93] font-medium text-xs">Reset manuale (con Codice Locale)</button>
              </div>
            </div>
          )}

          {mode === 'reset-search' && (
            <Card className="flex flex-col h-[400px]">
              <div className="p-3 border-b"><Input placeholder="Cerca il tuo nome..." value={search} onChange={e => setSearch(e.target.value)} /></div>
              <div className="flex-1 overflow-y-auto">
                {workerUsers.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase())).map(u => (
                  <button key={u.id} onClick={() => { setSelectedUser(u); setMode('reset-verify'); }} className="w-full p-4 flex justify-between items-center border-b active:bg-gray-50">
                    <span className="font-bold">{u.firstName} {u.lastName}</span>
                    <ChevronRight size={18} className="text-gray-300" />
                  </button>
                ))}
              </div>
              <Button variant="ghost" onClick={() => setMode('pin')}>Indietro</Button>
            </Card>
          )}

          {mode === 'reset-verify' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
              <p className="text-xs font-bold text-center text-gray-400">CIAO {selectedUser?.firstName}, INSERISCI CODICE LOCALE</p>
              <Input className="text-center font-black tracking-widest uppercase" value={masterCodeInput} onChange={e => setMasterCodeInput(e.target.value)} />
              <Button fullWidth onClick={handleVerifyMasterCode}>Verifica</Button>
              <Button variant="ghost" fullWidth onClick={() => setMode('reset-search')}>Torna alla lista</Button>
            </div>
          )}

          {mode === 'reset-new-pin' && renderNumpad(newPin, setNewPin, async () => {
            if (newPin.length < 4) return;
            await db.updateUserPin(selectedUser!.id, newPin);
            setPin(newPin); setMode('pin'); setError('PIN aggiornato con successo!');
          })}
        </div>
      </div>

      {showRecover && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRecover(false)} />
          <div className="relative bg-white rounded-t-[32px] p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto" />
            <h2 className="text-2xl font-bold">Recupero PIN</h2>
            <p className="text-gray-500 text-sm">Puoi richiedere il tuo PIN al manager tramite WhatsApp oppure fare il reset manuale.</p>
            
            <div className="space-y-3">
              <Button fullWidth onClick={() => handleWhatsAppHelp()} className="!bg-[#25D366]">
                Chiedi su WhatsApp
              </Button>
              <Button fullWidth variant="secondary" onClick={() => { setShowRecover(false); startReset(); }}>
                Usa Reset Manuale
              </Button>
              <Button fullWidth variant="ghost" onClick={() => setShowRecover(false)}>Chiudi</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
