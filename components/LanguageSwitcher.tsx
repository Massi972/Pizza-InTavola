import React, { useState, useRef, useEffect } from 'react';
import { useTranslation, FLAGS, Language } from '../services/i18n';

interface LanguageSwitcherProps {
  direction?: 'up' | 'down';
  align?: 'left' | 'right' | 'center';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  direction = 'down',
  align = 'center'
}) => {
  const { language, setLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const languageNames: Record<Language, string> = {
    it: 'Italiano',
    en: 'English',
    es: 'Español',
    ar: 'العربية',
    ur: 'اردو'
  };

  const currentFlagOnly = FLAGS[language]?.split(' ')[0] || '';
  const currentName = languageNames[language] || '';

  // Classi per direzione (sopra o sotto il bottone)
  const menuPositionClass = direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2';

  // Classi per allineamento orizzontale
  let alignClass = 'left-1/2 -translate-x-1/2';
  if (align === 'left') alignClass = 'left-0';
  if (align === 'right') alignClass = 'right-0';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#C6C6C8]/30 rounded-full shadow-sm hover:bg-gray-50 active:scale-95 transition-all text-xs font-bold text-[#1c1c1e] focus:outline-none"
      >
        <span className="text-sm leading-none">{currentFlagOnly}</span>
        <span>{currentName}</span>
        <svg
          className={`w-3 h-3 text-[#8E8E93] transition-transform duration-250 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute ${menuPositionClass} ${alignClass} bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-[#C6C6C8]/25 p-1 z-[100] min-w-[130px] animate-in fade-in zoom-in-95 duration-200`}
        >
          <div className="flex flex-col gap-0.5">
            {(Object.keys(FLAGS) as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => {
                  setLanguage(lang);
                  setIsOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                  language === lang
                    ? 'bg-[#007AFF] text-white'
                    : 'text-[#1c1c1e] hover:bg-[#F2F2F7] active:bg-[#E5E5EA]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm leading-none">{FLAGS[lang].split(' ')[0]}</span>
                  <span>{languageNames[lang]}</span>
                </div>
                {language === lang && (
                  <svg
                    className="w-3.5 h-3.5 stroke-current"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="3.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
