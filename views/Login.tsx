import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User } from '../types';
import { PizzaIcon, Smartphone, Mail, X, CheckCircle2, ShieldQuestion } from '../components/Icons';
import { Button, Input } from '../components/UI';
import { useTranslation } from '../services/i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

interface LoginProps {
  onLogin: (user: User) => void;
  onRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onRegister }) => {
  const { t, isRtl, language } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showRecovery, setShowRecovery] = useState(false);
  
  // Recovery form states
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveredPin, setRecoveredPin] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState('');

  const handleLogin = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setError('');
    try {
      const user = await db.getUserByPin(pin);
      if (user) {
        onLogin(user);
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        setError(t('invalidPin'));
        setPin('');
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || t('connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async () => {
    if (!recoveryEmail || !recoveryPhone) {
      setRecoveryError(t('requiredFields'));
      return;
    }
    setRecoveryLoading(true);
    setRecoveryError('');
    try {
      const pin = await db.verifyUserForPinRecovery(recoveryEmail, recoveryPhone);
      if (pin) {
        setRecoveredPin(pin);
      } else {
        setRecoveryError(t('mismatchError'));
      }
    } catch (err) {
      setRecoveryError(t('genericError'));
    } finally {
      setRecoveryLoading(false);
    }
  };

  const closeRecovery = () => {
    setShowRecovery(false);
    setRecoveredPin(null);
    setRecoveryEmail('');
    setRecoveryPhone('');
    setRecoveryError('');
  };

  const addDigit = (d: string) => {
    if (pin.length < 6) {
      const newPin = pin + d;
      setPin(newPin);
      setError('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F2F2F7] safe-top safe-bottom relative animate-in fade-in duration-300">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-xs flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-6 mt-8">
          <div className="w-24 h-24 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-[22%] flex items-center justify-center shadow-2xl">
             <PizzaIcon size={48} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tighter text-[#1c1c1e]">InTavola Staff</h1>
            <p className="text-[#8E8E93] text-[10px] font-black uppercase tracking-[0.3em] mt-1">
              {language === 'it' && "Area Riservata Dipendenti"}
              {language === 'en' && "Employee Private Area"}
              {language === 'es' && "Área Privada de Empleados"}
              {language === 'ar' && "منطقة خاصة بالموظفين"}
              {language === 'ur' && "ملازمین کا خفیہ ایریا"}
            </p>
          </div>
        </div>

        <div className="w-full flex flex-col items-center">
          {error && <p className="text-center text-xs font-bold mb-6 text-[#FF3B30] animate-bounce">{error}</p>}
          
          <div className="w-full max-w-[280px]">
            <div className="flex justify-center gap-4 mb-10">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all duration-200 ${pin.length > i ? 'bg-[#007AFF] border-[#007AFF] scale-125' : 'bg-transparent border-[#C6C6C8]'}`} />
              ))}
            </div>
            
            <div className="grid grid-cols-3 gap-y-4 gap-x-6">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                <button key={d} onClick={() => addDigit(d)} className="w-16 h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA] flex items-center justify-center mx-auto transition-colors">{d}</button>
              ))}
              
              <div className="w-16 h-16" />

              <button onClick={() => addDigit('0')} className="w-16 h-16 rounded-full bg-white text-2xl font-semibold ios-shadow active:bg-[#E5E5EA] flex items-center justify-center mx-auto">0</button>
              
              <button 
                onClick={handleLogin} 
                disabled={pin.length < 4 || loading} 
                className="w-16 h-16 rounded-full bg-[#007AFF] text-white text-[10px] font-black shadow-lg flex items-center justify-center mx-auto active:scale-95 disabled:opacity-50 transition-all uppercase"
              >
                {loading ? <div className="loading-spinner border-white border-t-transparent" /> : (
                  language === 'it' ? 'ENTRA' :
                  language === 'en' ? 'ENTER' :
                  language === 'es' ? 'ENTRAR' :
                  language === 'ar' ? 'دخول' : 'داخل ہوں'
                )}
              </button>
            </div>
            
            <div className="flex flex-col gap-3 mt-8">
              <button onClick={() => setPin('')} className="w-full text-[10px] font-black text-[#8E8E93] uppercase tracking-[0.2em]">{t('deleteKey')}</button>
              
              {(failedAttempts >= 3 || pin === '') && (
                <button 
                  onClick={() => setShowRecovery(true)}
                  className="w-full text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center justify-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
                >
                  <ShieldQuestion size={12} /> {t('forgotPin')}
                </button>
              )}
            </div>

            <button 
              onClick={onRegister} 
              className="w-full mt-10 py-3 rounded-2xl bg-white border border-[#D1D1D6] text-xs font-bold text-[#1c1c1e] shadow-sm uppercase tracking-widest active:scale-95 transition-all"
            >
              {t('notOnList')}
            </button>
          </div>
          
          <p className="text-center mt-12 text-[9px] font-bold text-[#C6C6C8] uppercase tracking-[0.1em] max-w-[200px] leading-relaxed">
            {language === 'it' && "Per sicurezza, la sessione scade quando chiudi l'app."}
            {language === 'en' && "For security, the session expires when you close the app."}
            {language === 'es' && "Por seguridad, la sesión caduca al cerrar la aplicación."}
            {language === 'ar' && "لدواعي الأمن، تنتهي الجلسة عند إغلاق التطبيق."}
            {language === 'ur' && "سیکیورٹی کے لیے، جب آپ ایپ بند کرتے ہیں تو سیشن ختم ہو جاتا ہے۔"}
          </p>
        </div>
      </div>

      {/* MODAL RECUPERO PIN */}
      {showRecovery && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-center items-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-8 space-y-6 shadow-2xl relative">
            <button onClick={closeRecovery} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full text-gray-500 active:scale-90 transition-transform">
              <X size={20} />
            </button>

            {!recoveredPin ? (
              <>
                <div className="space-y-2">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-2">
                    <ShieldQuestion size={28} />
                  </div>
                  <h3 className="text-2xl font-black tracking-tight">{t('recoveryTitle')}</h3>
                  <p className="text-sm text-[#8E8E93] font-medium">{t('recoveryDesc')}</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest px-1">{t('emailLabel')}</label>
                    <Input 
                      placeholder="la-tua@email.it"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      icon={<Mail size={16} />}
                      className="!bg-[#F2F2F7] !border-none !rounded-2xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest px-1">{t('phoneLabel')}</label>
                    <Input 
                      placeholder="+39 333 1234567"
                      value={recoveryPhone}
                      onChange={(e) => setRecoveryPhone(e.target.value)}
                      icon={<Smartphone size={16} />}
                      className="!bg-[#F2F2F7] !border-none !rounded-2xl"
                    />
                  </div>

                  {recoveryError && <p className="text-xs font-bold text-red-500 px-1">{recoveryError}</p>}

                  <Button 
                    fullWidth 
                    onClick={handleRecovery}
                    loading={recoveryLoading}
                    className="!rounded-2xl !bg-[#007AFF] !h-14 font-black tracking-widest pt-1"
                  >
                    {t('verifyIdentity')}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 space-y-6 animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 scale-animation">
                  <CheckCircle2 size={42} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-black tracking-tight">{t('verifiedIdentity')}</h3>
                  <div className="bg-[#F2F2F7] p-6 rounded-[28px] mt-4 border-2 border-green-200">
                    <p className="text-[10px] font-black text-[#8E8E93] uppercase tracking-[0.2em] mb-4 text-center">{t('yourPersonalPin')}:</p>
                    <div className="flex justify-center gap-4">
                      {recoveredPin.split('').map((digit, idx) => (
                        <span key={idx} className="text-4xl font-black text-[#007AFF] tabular-nums">{digit}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 max-w-[280px] mx-auto">
                  <p className="text-xs font-medium text-[#1c1c1e] bg-indigo-50 p-4 rounded-2xl border border-indigo-100 italic leading-relaxed">
                    "{t('recWarning')}"
                  </p>
                  
                  <Button 
                    fullWidth 
                    onClick={closeRecovery}
                    className="!rounded-2xl !bg-black text-white font-black tracking-widest pt-1"
                  >
                    {t('understandButton')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
