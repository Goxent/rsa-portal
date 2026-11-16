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
                    className="w-4 h-4 rounded border-[var(--border-mid)] bg-[var(--bg-main)] text-[var(--accent)] focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer accent-[var(--accent)]"
                    {...props}
                />
            </div>
            {(label || description) && (
                <div className="ml-2.5 text-xs">
                    {label && (
                        <label htmlFor={checkboxId} className={`font-medium cursor-pointer ${disabled ? 'text-[var(--text-muted)] opacity-50' : 'text-[var(--text-heading)]'}`}>
                            {label}
                        </label>
                    )}
                    {description && (
                        <p className="text-[var(--text-muted)] text-[11px] mt-0.5">{description}</p>
                    )}
                    {error && (
                        <p className="text-[var(--color-danger)] text-[11px] mt-0.5">{error}</p>
                    )}
                </div>
            )}
        </div>
    );
});

Checkbox.displayName = "Checkbox";

export default Checkbox;
