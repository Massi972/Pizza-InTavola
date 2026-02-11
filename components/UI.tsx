import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "px-4 py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-[#007AFF] text-white shadow-sm",
    secondary: "bg-[#E5E5EA] text-[#000000] hover:bg-[#D1D1D6]",
    danger: "bg-[#FF3B30] text-white shadow-sm",
    ghost: "bg-transparent text-[#007AFF] hover:bg-[#F2F2F7]"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => {
  return (
    <input 
      className={`w-full px-4 py-3 rounded-xl bg-white border border-[#C6C6C8] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] outline-none transition-all ${className}`}
      {...props}
    />
  );
};

// FIX: Estendiamo correttamente React.HTMLAttributes per includere className, onClick e altri attributi standard
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

// FIX: Convertiamo Card in React.FC per gestire correttamente i prop speciali di React come 'key'
// e assicurare che 'className' sia riconosciuto correttamente durante la destrutturazione.
export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`bg-white rounded-2xl ios-shadow overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const SegmentedControl: React.FC<{
  options: string[];
  selected: string;
  onChange: (value: string) => void;
}> = ({ options, selected, onChange }) => {
  return (
    <div className="flex p-1 bg-[#E5E5EA] rounded-xl w-full">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            selected === option 
              ? "bg-white text-black shadow-sm" 
              : "text-[#8E8E93] hover:text-[#000000]"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
};
