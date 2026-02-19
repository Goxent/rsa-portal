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

    // Generate random ID if not provided and label is present
    const inputId = id || (label ? `input-${Math.random().toString(36).substr(2, 9)}` : undefined);

    const baseInputStyles = "block rounded-xl border bg-white/5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed";
    const errorStyles = error
        ? "border-red-500/50 focus:ring-red-500"
        : "border-white/10 hover:border-white/20";

    const widthStyles = fullWidth ? "w-full" : "";
    const paddingLeft = leftIcon ? "pl-10" : "px-4";
    const paddingRight = rightIcon ? "pr-10" : "px-4";

    return (
        <div className={`${widthStyles} ${className}`}>
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium text-gray-300 mb-1.5"
                >
                    {label}
                </label>
            )}

            <div className="relative">
                {leftIcon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        {leftIcon}
                    </div>
                )}

                <input
                    ref={ref}
                    id={inputId}
                    className={`
                        ${baseInputStyles}
                        ${errorStyles}
                        ${widthStyles}
                        ${paddingLeft}
                        ${paddingRight}
                        h-10 text-sm
                    `}
                    disabled={disabled}
                    aria-invalid={!!error}
                    {...props}
                />

                {rightIcon && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                        {rightIcon}
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-1.5 flex items-center text-xs text-red-400 animate-fade-in">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    <span>{error}</span>
                </div>
            )}

            {!error && helperText && (
                <p className="mt-1.5 text-xs text-gray-500">
                    {helperText}
                </p>
            )}
        </div>
    );
});

Input.displayName = "Input";

export default Input;
