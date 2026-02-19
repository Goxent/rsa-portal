import React, { TextareaHTMLAttributes, forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    fullWidth?: boolean;
    helperText?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
    className = '',
    label,
    error,
    fullWidth = true,
    helperText,
    id,
    disabled,
    rows = 4,
    ...props
}, ref) => {

    // Generate random ID if not provided and label is present
    const textareaId = id || (label ? `textarea-${Math.random().toString(36).substr(2, 9)}` : undefined);

    const baseInputStyles = "block rounded-xl border bg-white/5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-y";
    const errorStyles = error
        ? "border-red-500/50 focus:ring-red-500"
        : "border-white/10 hover:border-white/20";

    const widthStyles = fullWidth ? "w-full" : "";

    return (
        <div className={`${widthStyles} ${className}`}>
            {label && (
                <label
                    htmlFor={textareaId}
                    className="block text-sm font-medium text-gray-300 mb-1.5"
                >
                    {label}
                </label>
            )}

            <div className="relative">
                <textarea
                    ref={ref}
                    id={textareaId}
                    rows={rows}
                    className={`
                        ${baseInputStyles}
                        ${errorStyles}
                        ${widthStyles}
                        px-4 py-3 text-sm
                    `}
                    disabled={disabled}
                    aria-invalid={!!error}
                    {...props}
                />
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

Textarea.displayName = "Textarea";

export default Textarea;
