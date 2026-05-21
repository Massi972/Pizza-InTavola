import React from 'react';
import { useTranslation, FLAGS, Language } from '../services/i18n';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useTranslation();

  return (
    <div className="flex justify-center items-center gap-1 p-1 bg-white border border-[#C6C6C8]/25 rounded-full inline-flex shadow-sm">
      {Object.entries(FLAGS).map(([lang, label]) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang as Language)}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all text-xs active:scale-90 font-black ${
            language === lang ? 'bg-[#007AFF] text-white shadow-sm' : 'text-[#8E8E93] hover:bg-gray-50'
          }`}
          title={label}
        >
          {label.split(' ')[0]} {/* Solamente l'emoji della bandiera */}
        </button>
      ))}
    </div>
  );
};
