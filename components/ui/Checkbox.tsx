import React, { InputHTMLAttributes, forwardRef } from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    description?: string;
    error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
    className = '',
    label,
    description,
    error,
    id,
    disabled,
    ...props
}, ref) => {

    // Generate random ID if not provided and label is present
    const checkboxId = id || (label ? `checkbox-${Math.random().toString(36).substr(2, 9)}` : undefined);

    return (
        <div className={`flex items-start ${className}`}>
            <div className="flex items-center h-5">
                <input
                    type="checkbox"
                    ref={ref}
                    id={checkboxId}
                    disabled={disabled}
                    className="w-4 h-4 rounded border-gray-600 bg-white/5 text-brand-600 focus:ring-brand-500 focus:ring-offset-navy-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    {...props}
                />
            </div>
            {(label || description) && (
                <div className="ml-3 text-sm">
                    {label && (
                        <label htmlFor={checkboxId} className={`font-medium ${disabled ? 'text-gray-500' : 'text-gray-200'}`}>
                            {label}
                        </label>
                    )}
                    {description && (
                        <p className="text-gray-500">{description}</p>
                    )}
                    {error && (
                        <p className="text-red-400 text-xs mt-1">{error}</p>
                    )}
                </div>
            )}
        </div>
    );
});

Checkbox.displayName = "Checkbox";

export default Checkbox;
