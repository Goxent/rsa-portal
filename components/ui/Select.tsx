import React, { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

export interface SelectOption {
    label: string;
    value: string | number;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: SelectOption[];
    fullWidth?: boolean;
    helperText?: string;
    placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({
    className = '',
    label,
    error,
    options,
    fullWidth = true,
    helperText,
    id,
    disabled,
    placeholder,
    ...props
}, ref) => {
    const selectId = id || (label ? `select-${Math.random().toString(36).substr(2, 9)}` : undefined);

    const baseSelectStyles = "block w-full text-[0.875rem] appearance-none bg-transparent border-none text-[var(--text-heading)] px-3.5 pr-10 transition-all duration-150 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed h-full";
    
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
                    htmlFor={selectId}
                    className="block text-[0.8125rem] font-500 text-[var(--text-body)] mb-[0.375rem]"
                >
                    {label}
                </label>
            )}

            <div className={containerClasses} style={{ height: '2.375rem' }}>
                <select
                    ref={ref}
                    id={selectId}
                    className={baseSelectStyles}
                    disabled={disabled}
                    aria-invalid={!!error}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled className="bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                            {placeholder}
                        </option>
                    )}
                    {options.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                            className="bg-[var(--bg-secondary)] text-[var(--text-heading)]"
                        >
                            {option.label}
                        </option>
                    ))}
                </select>

                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                    <ChevronDown className="h-4 w-4" />
                </div>
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

Select.displayName = "Select";

export default Select;
