
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
  
  // Stati per recupero PIN
  const [showRecover, setShowRecover] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverMessage, setRecoverMessage] = useState('');

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

  const startReset = async () => {
    setLoading(true);
    try {
      const users = await db.getUsers();
      const onlyWorkers = users.filter(u => u.active && u.role === Role.WORKER);
      setWorkerUsers(onlyWorkers);
      setMode('reset-search');
    } catch (err) {
      setError('Errore nel recupero utenti');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverPin = async () => {
    if (!recoverEmail) return;
    setIsRecovering(true);
    setRecoverMessage('');
    try {
      await db.recoverPin(recoverEmail);
      setRecoverMessage('Se l’email è registrata, riceverai un messaggio con il tuo PIN.');
    } catch (err) {
      setRecoverMessage('Errore durante la richiesta. Riprova più tardi.');
    } finally {
      setIsRecovering(false);
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

  const handleSetNewPin = async () => {
    if (!selectedUser || newPin.length < 4) return;
    setLoading(true);
    setError('');
    try {
      const isAvailable = await db.isPinAvailable(newPin);
      if (!isAvailable) {
        setError('Questo PIN è già in uso da un altro dipendente. Scegline uno diverso.');
        setNewPin('');
        setLoading(false);
        return;
      }

      await db.updateUserPin(selectedUser.id, newPin);
      setPin(newPin);
      setMode('pin');
      setError('PIN aggiornato! Ora puoi entrare.');
      setNewPin('');
      setMasterCodeInput('');
      setSelectedUser(null);
    } catch (err) {
      setError('Errore aggiornamento PIN');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = workerUsers.filter(u => 
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const renderNumpad = (value: string, setValue: (v: string) => void, onConfirm: () => void, maxLength = 6) => (
    <div className="w-full">
      <div className="flex justify-center gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${value.length > i ? 'bg-[#007AFF] border-[#007AFF] scale-110' : 'bg-transparent border-[#C6C6C8]'}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button key={d} onClick={() => { if(value.length < maxLength) setValue(value + d); setError(''); }} className="h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA]">{d}</button>
        ))}
        <button onClick={() => setValue('')} className="h-16 rounded-full text-xs font-bold text-[#FF3B30]">CANCELLA</button>
        <button onClick={() => { if(value.length < maxLength) setValue(value + '0'); setError(''); }} className="h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA]">0</button>
        <button onClick={onConfirm} disabled={value.length < 4 || loading} className="h-16 rounded-full bg-[#007AFF] text-white text-sm font-bold shadow-md flex items-center justify-center">
          {loading ? <div className="loading-spinner border-white border-t-transparent" /> : 'OK'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F2F2F7]">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        
        <div className="flex flex-col items-center gap-3">
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl p-0.5 overflow-hidden">
            <img 
              src="/logo.png" 
              alt="Pizza InTavola Logo" 
              className="w-full h-full object-contain scale-[1.05]"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/google/material-design-icons/master/png/maps/local_pizza/black/48dp/2x/local_pizza_black_48dp.png';
              }}
            />
          </div>
          <h1 className="text-3xl font-black tracking-tighter mt-4 text-[#1c1c1e]">Pizza InTavola</h1>
          <p className="text-[#8E8E93] font-medium text-center px-4">
            {mode === 'pin' ? 'Inserisci il tuo PIN personale' : 
             mode === 'reset-search' ? 'Cerca il tuo nome nella lista' :
             mode === 'reset-verify' ? `Ciao ${selectedUser?.firstName}, inserisci il Codice Locale` :
             'Imposta il tuo nuovo PIN di 4 cifre'}
          </p>
        </div>

        <div className="w-full">
          <div className="h-6 mb-4">
            {error && <p className={`text-center text-sm font-bold leading-tight px-4 ${error.includes('aggiornato') ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>{error}</p>}
          </div>

          {mode === 'pin' && (
            <div className="flex flex-col gap-4">
              {renderNumpad(pin, setPin, handleLogin)}
              <div className="flex flex-col gap-3 mt-4">
                <button onClick={() => setShowRecover(true)} className="w-full text-[#007AFF] font-bold text-sm">
                  Non ricordi il PIN?
                </button>
                <button onClick={startReset} className="w-full text-[#8E8E93] font-medium text-xs">
                  Primo accesso o reset manuale
                </button>
              </div>
            </div>
          )}

          {mode === 'reset-search' && (
            <Card className="flex flex-col h-[400px]">
              <div className="p-3 border-b">
                <Input placeholder="Cerca il tuo nome..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredUsers.length > 0 ? filteredUsers.map(u => (
                  <button key={u.id} onClick={() => { setSelectedUser(u); setMode('reset-verify'); setError(''); }} className="w-full p-4 flex justify-between items-center border-b active:bg-[#F2F2F7]">
                    <span className="font-bold">{u.firstName} {u.lastName}</span>
                    <ChevronRight size={18} className="text-[#C6C6C8]" />
                  </button>
                )) : (
                  <p className="p-10 text-center text-[#8E8E93] text-sm italic">Nessun dipendente trovato</p>
                )}
              </div>
              <Button variant="ghost" onClick={() => setMode('pin')}>Annulla</Button>
            </Card>
          )}

          {mode === 'reset-verify' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl ios-shadow space-y-4">
                <p className="text-xs font-bold text-[#8E8E93] uppercase text-center">Inserisci Codice Locale</p>
                <Input 
                  placeholder="Es: PIZZA2025" 
                  className="text-center font-bold tracking-widest uppercase" 
                  value={masterCodeInput} 
                  onChange={e => setMasterCodeInput(e.target.value)}
                  autoFocus
                />
                <Button fullWidth onClick={handleVerifyMasterCode} disabled={!masterCodeInput || loading}>Verifica Codice</Button>
                <Button variant="ghost" fullWidth onClick={() => setMode('reset-search')}>Torna indietro</Button>
              </div>
            </div>
          )}

          {mode === 'reset-new-pin' && renderNumpad(newPin, setNewPin, handleSetNewPin)}
        </div>
      </div>

      {/* MODALE RECUPERO PIN (BOTTOM SHEET iOS STYLE) */}
      {showRecover && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isRecovering && setShowRecover(false)} />
          <div className="relative bg-white rounded-t-[32px] p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-[#E5E5EA] rounded-full mx-auto mb-2" />
            
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Recupero PIN</h2>
              <button disabled={isRecovering} onClick={() => setShowRecover(false)} className="bg-[#F2F2F7] p-2 rounded-full">
                <X size={20} />
              </button>
            </div>

            {recoverMessage ? (
              <div className="bg-[#F2F2F7] p-6 rounded-2xl flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 bg-[#34C759] rounded-full flex items-center justify-center text-white">
                   <Check size={24} />
                </div>
                <p className="font-bold text-[#1c1c1e]">{recoverMessage}</p>
                <Button fullWidth onClick={() => setShowRecover(false)}>Chiudi</Button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <p className="text-[#8E8E93] text-sm font-medium">
                    Inserisci l'email che l'amministratore ha registrato per il tuo profilo. Riceverai il tuo PIN attuale.
                  </p>
                  <Input 
                    type="email"
                    placeholder="La tua email personale"
                    value={recoverEmail}
                    onChange={(e) => setRecoverEmail(e.target.value)}
                    disabled={isRecovering}
                    autoFocus
                  />
                </div>
                <div className="pt-2">
                  <Button fullWidth onClick={handleRecoverPin} disabled={!recoverEmail || isRecovering}>
                    {isRecovering ? <div className="loading-spinner border-white border-t-transparent" /> : 'Invia PIN'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
