
import React, { useState } from 'react';
import { db } from '../services/db';
import { User, Role } from '../types';
import { Layout } from '../components/Layout';
import { Button, Input, Card } from '../components/UI';
import { Check, UserPlus, ShieldCheck, AlertCircle, ArrowLeft, Smartphone, Share, MoreVertical } from '../components/Icons';
import { useTranslation } from '../services/i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

interface RegisterProps {
  onBack: () => void;
  onSuccess: (user: User) => void;
}

const Register: React.FC<RegisterProps> = ({ onBack, onSuccess }) => {
  const { t, isRtl, language } = useTranslation();
  const [step, setStep] = useState(1);
  const [registeredUser, setRegisteredUser] = useState<User | null>(null);
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
      setError(t('localCodeLabel'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const settings = await db.getSettings();
      
      // Controllo se le registrazioni sono aperte
      if (settings.registration_open === false) {
        setError(t('registrationClosed'));
        setLoading(false);
        return;
      }

      if (cleanPin === String(settings.registration_pin).trim()) {
        setStep(2);
      } else {
        setError(t('invalidLocalCode'));
      }
    } catch (err) {
      setError(t('connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const validateFields = () => {
    if (!userData.firstName.trim() || !userData.lastName.trim()) return t('requiredFields');
    if (!userData.phone_e164.trim() || userData.phone_e164 === '+39') return t('phoneRequired');
    if (!userData.email.trim() || !userData.email.includes('@')) return t('emailRequired');
    if (!userData.pin || userData.pin.length < 4) return t('pinRequiredLength');
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
        setError(t('pinMatchesMasterError'));
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
        setError(t('pinTaken'));
        setLoading(false);
        return;
      }

      if (!isEmailAvailable) {
        setError(t('emailTaken'));
        setLoading(false);
        return;
      }

      if (!isPhoneAvailable) {
        setError(t('phoneTaken'));
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
        setRegisteredUser(user);
        setStep(3); // Passaggio alla guida installazione
      } else {
        onBack();
      }
    } catch (err: any) {
      setError(err.message || t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title={t('registerTitle')} onBack={onBack}>
      <div className="space-y-6 py-4">
        <div className="flex justify-center">
          <LanguageSwitcher direction="down" align="center" />
        </div>
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-[#007AFF]/10 text-[#007AFF] rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-xl font-bold">{t('verifyIdentity')}</h2>
              <p className="text-sm text-[#8E8E93]">{t('localCodeLabel')}</p>
            </div>

            <Card className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest pl-1">{t('localCodeLabel')}</label>
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
                {loading ? <div className="loading-spinner border-white border-t-transparent" /> : t('continueBtn')}
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
              <h2 className="text-xl font-bold">
                {language === 'it' && "I tuoi dati"}
                {language === 'en' && "Your Details"}
                {language === 'es' && "Tus Datos"}
                {language === 'ar' && "بياناتك الشخصية"}
                {language === 'ur' && "آپ کی معلومات"}
              </h2>
              <p className="text-sm text-[#8E8E93]">
                {language === 'it' && "Crea il tuo profilo per iniziare a ordinare."}
                {language === 'en' && "Create your profile to start ordering."}
                {language === 'es' && "Crea tu perfil para empezar a pedir."}
                {language === 'ar' && "أنشئ ملفك الشخصي لتتمكن من تقديم الطلب."}
                {language === 'ur' && "آرڈر شروع کرنے کے لیے اپنا پروفائل بنائیں۔"}
              </p>
            </div>

            <Card className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">{t('firstNameLabel')}</label>
                  <Input placeholder={t('firstNamePlaceholder')} value={userData.firstName} onChange={e => setUserData({...userData, firstName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">{t('lastNameLabel')}</label>
                  <Input placeholder={t('lastNamePlaceholder')} value={userData.lastName} onChange={e => setUserData({...userData, lastName: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">{t('emailLabel')}</label>
                <Input placeholder={t('emailPlaceholder')} type="email" value={userData.email} onChange={e => setUserData({...userData, email: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">{t('phoneLabel')}</label>
                <Input placeholder="+39..." type="tel" value={userData.phone_e164} onChange={e => setUserData({...userData, phone_e164: e.target.value})} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8E8E93] uppercase pl-1">{t('choosePinLabel')}</label>
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
                {loading ? <div className="loading-spinner border-white border-t-transparent" /> : t('completeRegBtn')}
              </Button>

              <button 
                onClick={() => setStep(1)}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-[#8E8E93] uppercase"
              >
                <ArrowLeft size={14} /> {t('backBtn')}
              </button>
            </Card>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in zoom-in duration-500">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} />
              </div>
              <h2 className="text-2xl font-black tracking-tight">{t('regCompleteTitle')}</h2>
              <p className="text-sm font-medium text-[#8E8E93] max-w-[250px] mx-auto">
                {t('regCompleteDesc')}
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-bold text-[#8E8E93] uppercase tracking-widest text-center">
                {t('addToHomeTitle')}
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                {/* Android Guide */}
                <div className="bg-white border border-gray-100 p-4 rounded-[24px] shadow-sm flex gap-4 items-start">
                  <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                    <Smartphone size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black flex items-center gap-2">{t('androidGuideTitle')}</p>
                    <p className="text-[11px] leading-relaxed text-gray-600">
                      {t('androidGuideDesc')}
                    </p>
                  </div>
                </div>

                {/* iPhone Guide */}
                <div className="bg-white border border-gray-100 p-4 rounded-[24px] shadow-sm flex gap-4 items-start">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                    <Share size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black flex items-center gap-2">{t('iosGuideTitle')}</p>
                    <p className="text-[11px] leading-relaxed text-gray-600 flex flex-wrap gap-1 items-center">
                      {t('iosGuideDesc')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  fullWidth 
                  onClick={() => registeredUser && onSuccess(registeredUser)}
                  className="!rounded-[20px]"
                >
                  {t('backToLoginBtn')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Register;
