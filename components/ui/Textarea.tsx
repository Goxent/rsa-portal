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
    const textareaId = id || (label ? `textarea-${Math.random().toString(36).substr(2, 9)}` : undefined);

    const baseTextareaStyles = "block w-full text-[0.875rem] transition-all duration-150 ease-in-out placeholder:text-[var(--text-muted)] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-y px-3.5 py-2.5 bg-transparent border-none text-[var(--text-heading)]";
    
    const containerClasses = `
        relative flex bg-[var(--bg-surface)] border rounded-[var(--radius-md)]
        ${error 
            ? 'border-[var(--color-danger)] shadow-[0_0_0_3px_rgba(196,68,90,0.15)]' 
            : 'border-[var(--border-mid)] hover:border-[var(--border-accent)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-dim)]'}
    `;

    return (
        <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
            {label && (
                <label
                    htmlFor={textareaId}
                    className="block text-[0.8125rem] font-500 text-[var(--text-body)] mb-[0.375rem]"
                >
                    {label}
                </label>
            )}

            <div className={containerClasses}>
                <textarea
                    ref={ref}
                    id={textareaId}
                    rows={rows}
                    className={baseTextareaStyles}
                    disabled={disabled}
                    aria-invalid={!!error}
                    {...props}
                />
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

Textarea.displayName = "Textarea";

export default Textarea;
