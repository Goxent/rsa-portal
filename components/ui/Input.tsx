import React, { InputHTMLAttributes, forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
    helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
    className = '',
    label,
    error,
    leftIcon,
    rightIcon,
    fullWidth = true,
    helperText,
    id,
    disabled,
    ...props
}, ref) => {
    const inputId = id || (label ? `input-${Math.random().toString(36).substr(2, 9)}` : undefined);

    const baseInputStyles = "block w-full text-[0.875rem] transition-all duration-150 ease-in-out placeholder:text-[var(--text-muted)] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";
    
    const containerClasses = `
        relative flex items-center bg-[var(--bg-surface)] border rounded-[var(--radius-md)]
        ${error 
            ? 'border-[var(--color-danger)] shadow-[0_0_0_3px_rgba(196,68,90,0.15)]' 
            : 'border-[var(--border-mid)] hover:border-[var(--border-accent)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-dim)]'}
    `;

    return (
        <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-[0.8125rem] font-500 text-[var(--text-body)] mb-[0.375rem]"
                >
                    {label}
                </label>
            )}

            <div className={containerClasses} style={{ height: '2.375rem' }}>
                {leftIcon && (
                    <div className="pl-3.5 flex items-center justify-center text-[var(--text-muted)]">
                        {leftIcon}
                    </div>
                )}

                <input
                    ref={ref}
                    id={inputId}
                    className={`
                        ${baseInputStyles}
                        bg-transparent border-none text-[var(--text-heading)]
                        ${leftIcon ? 'pl-2' : 'pl-3.5'}
                        ${rightIcon ? 'pr-2' : 'pr-3.5'}
                        h-full
                    `}
                    disabled={disabled}
                    aria-invalid={!!error}
                    {...props}
                />

                {rightIcon && (
                    <div className="pr-3.5 flex items-center justify-center text-[var(--text-muted)]">
                        {rightIcon}
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-[0.25rem] flex items-center text-[0.75rem] text-[var(--color-danger)] animate-fade-in">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    <span>{error}</span>
                </div>
            )}

            {!error && helperText && (
                <p className="mt-[0.25rem] text-[0.75rem] text-[var(--text-muted)]">
                    {helperText}
                </p>
            )}
        </div>
    );
});

Input.displayName = "Input";

export default Input;
