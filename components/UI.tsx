
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  fullWidth = false, 
  loading = false,
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
    secondary: "bg-[#E5E5EA] text-[#000000] hover:bg-[#D1D1D6]",
    danger: "bg-[#FF3B30] text-white shadow-sm",
    ghost: "bg-transparent text-[#007AFF] hover:bg-[#F2F2F7]"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ className = '', icon, ...props }) => {
  return (
    <div className="relative w-full">
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]">
          {icon}
        </div>
      )}
      <input 
        className={`w-full ${icon ? 'pl-11' : 'px-4'} py-3 rounded-xl bg-white border border-[#C6C6C8] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] outline-none transition-all ${className}`}
        {...props}
      />
    </div>
  );
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

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
