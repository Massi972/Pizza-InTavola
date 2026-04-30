
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2";
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-3 text-sm",
    lg: "px-6 py-4 text-base"
  };

  const variants = {
    primary: "bg-[#007AFF] text-white shadow-sm",
    secondary: "bg-[#E5E5EA] dark:bg-[#1c1c1e] text-[#000000] dark:text-white hover:bg-[#D1D1D6] dark:hover:bg-[#2c2c2e]",
    danger: "bg-[#FF3B30] text-white shadow-sm",
    ghost: "bg-transparent text-[#007AFF] hover:bg-[#F2F2F7] dark:hover:bg-[#1c1c1e]"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => {
  return (
    <input 
      className={`w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1c1c1e] text-black dark:text-white border border-[#C6C6C8] dark:border-[#38383a] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] outline-none transition-all ${className}`}
      {...props}
    />
  );
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`bg-white dark:bg-[#1c1c1e] text-black dark:text-white rounded-2xl ios-shadow overflow-hidden border border-transparent dark:border-[#38383a] ${className}`}
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
    <div className="flex p-1 bg-[#E5E5EA] dark:bg-[#1c1c1e] rounded-xl w-full">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
            selected === option 
              ? "bg-white dark:bg-[#38383a] text-black dark:text-white shadow-sm" 
              : "text-[#8E8E93] hover:text-[#000000] dark:hover:text-white"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
};
