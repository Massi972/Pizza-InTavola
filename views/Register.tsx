
import React, { useState } from 'react';
import { db } from '../services/db';
import { User, Role } from '../types';
import { Layout } from '../components/Layout';
import { Button, Input, Card } from '../components/UI';
import { Check, UserPlus, ShieldCheck, AlertCircle, ArrowLeft } from '../components/Icons';

interface RegisterProps {
  onBack: () => void;
  onSuccess: (user: User) => void;
}

const Register: React.FC<RegisterProps> = ({ onBack, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [masterPin, setMasterPin] = useState('');
  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    phone_e164: '+39',
    email: '',
    pin: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerifyMaster = async () => {
    const cleanPin = masterPin.trim();
    if (!cleanPin) {
      setError('Inserisci il codice locale');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const settings = await db.getSettings();
      
      // Controllo se le registrazioni sono aperte
      if (settings.registration_open === false) {
        setError('Le registrazioni sono attualmente chiuse. Contatta l\'amministratore.');
        setLoading(false);
        return;
      }

      if (cleanPin === String(settings.registration_pin).trim()) {
        setStep(2);
      } else {
        setError('Codice di Registrazione non valido. Chiedi al responsabile.');
      }
    } catch (err) {
      setError('Errore di connessione al sistema');
    } finally {
      setLoading(false);
    }
  };

  const validateFields = () => {
    if (!userData.firstName.trim() || !userData.lastName.trim()) return "Nome e Cognome obbligatori";
    if (!userData.phone_e164.trim() || userData.phone_e164 === '+39') return "Numero di telefono obbligatorio";
    if (!userData.email.trim() || !userData.email.includes('@')) return "Email valida obbligatoria";
    if (!userData.pin || userData.pin.length < 4) return "PIN di 4 cifre obbligatorio";
    return null;
  };

  const handleRegister = async () => {
    const fieldError = validateFields();
    if (fieldError) {
      setError(fieldError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      // 1. Controllo che il PIN non sia uguale al Codice di Registrazione
      const settings = await db.getSettings();
      const currentMaster = settings.registration_pin;
      
      if (userData.pin === currentMaster) {
        setError('Il PIN personale non può essere uguale al Codice di Registrazione.');
        setLoading(false);
        return;
      }

      // 2. Verifiche asincrone di unicità in parallelo per velocità
      const [isPinAvailable, isEmailAvailable, isPhoneAvailable] = await Promise.all([
        db.isPinAvailable(userData.pin),
        db.isEmailAvailable(userData.email),
        db.isPhoneAvailable(userData.phone_e164)
      ]);

      if (!isPinAvailable) {
        setError('Questo PIN è già in uso o non disponibile. Scegline un altro.');
        setLoading(false);
        return;
      }

      if (!isEmailAvailable) {
        setError('Questa email è già associata a un account esistente.');
        setLoading(false);
        return;
      }

      if (!isPhoneAvailable) {
        setError('Questo numero di telefono è già associato a un account esistente.');
        setLoading(false);
        return;
      }

      const newUser: Partial<User> = {
        ...userData,
        role: Role.WORKER,
        active: true
      };

      await db.saveUser(newUser);
      
      // Recupera l'utente appena creato
      const user = await db.getUserByPin(userData.pin);
      if (user) {
        onSuccess(user);
      } else {
        onBack();
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Registrazione Staff" onBack={onBack}>
      <div className="space-y-6 py-4">
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-[#007AFF]/10 text-[#007AFF] rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-xl font-bold">Verifica Identità</h2>
              <p className="text-sm text-[#8E8E93]">Inserisci il Codice Locale per procedere.</p>
            </div>

            <Card className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest pl-1">Codice Locale</label>
                <Input 
                  type="password"
                  inputMode="numeric"
                  placeholder="0000"
                  value={masterPin}
                  onChange={e => setMasterPin(e.target.value)}
                  className="text-center text-2xl font-mono tracking-[0.5em]"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-[#FF3B30] text-xs font-bold bg-red-50 p-3 rounded-xl">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <Button fullWidth onClick={handleVerifyMaster} disabled={loading || !masterPin}>
                {loading ? <div className="loading-spinner border-white border-t-transparent" /> : 'Continua'}
              </Button>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <UserPlus size={32} />
              </div>
              <h2 className="text-xl font-bold">I tuoi dati</h2>
              <p className="text-sm text-[#8E8E93]">Crea il tuo profilo per iniziare a ordinare.</p>
            </div>

            <Card className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">Nome</label>
                  <Input placeholder="Es: Mario" value={userData.firstName} onChange={e => setUserData({...userData, firstName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">Cognome</label>
                  <Input placeholder="Es: Rossi" value={userData.lastName} onChange={e => setUserData({...userData, lastName: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">Email</label>
                <Input placeholder="mario.rossi@aziende.it" type="email" value={userData.email} onChange={e => setUserData({...userData, email: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">WhatsApp (+39...)</label>
                <Input placeholder="+39..." type="tel" value={userData.phone_e164} onChange={e => setUserData({...userData, phone_e164: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">Scegli il tuo PIN (4 cifre)</label>
                <Input 
                  placeholder="PIN" 
                  type="password" 
                  inputMode="numeric"
                  value={userData.pin} 
                  onChange={e => setUserData({...userData, pin: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                  className="font-mono text-center text-xl tracking-[1em]"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-[#FF3B30] text-xs font-bold bg-red-50 p-3 rounded-xl">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <Button fullWidth onClick={handleRegister} disabled={loading}>
                {loading ? <div className="loading-spinner border-white border-t-transparent" /> : 'Completa Registrazione'}
              </Button>

              <button 
                onClick={() => setStep(1)}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-[#8E8E93] uppercase"
              >
                <ArrowLeft size={14} /> Indietro
              </button>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Register;
