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

    // Generate random ID if not provided and label is present
    const selectId = id || (label ? `select-${Math.random().toString(36).substr(2, 9)}` : undefined);

    const baseSelectStyles = "block appearance-none rounded-xl border bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed";
    const errorStyles = error
        ? "border-red-500/50 focus:ring-red-500"
        : "border-white/10 hover:border-white/20";

    const widthStyles = fullWidth ? "w-full" : "";

    return (
        <div className={`${widthStyles} ${className}`}>
            {label && (
                <label
                    htmlFor={selectId}
                    className="block text-sm font-medium text-gray-300 mb-1.5"
                >
                    {label}
                </label>
            )}

            <div className="relative">
                <select
                    ref={ref}
                    id={selectId}
                    className={`
                        ${baseSelectStyles}
                        ${errorStyles}
                        ${widthStyles}
                        h-10 px-4 pr-10 text-sm
                    `}
                    disabled={disabled}
                    aria-invalid={!!error}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled className="bg-navy-900 text-gray-500">
                            {placeholder}
                        </option>
                    )}
                    {options.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                            className="bg-navy-900 text-white"
                        >
                            {option.label}
                        </option>
                    ))}
                </select>

                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                    <ChevronDown className="h-4 w-4" />
                </div>
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

Select.displayName = "Select";

export default Select;
