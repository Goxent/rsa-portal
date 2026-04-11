import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
    className = '',
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    children,
    disabled,
    ...props
}, ref) => {

    const baseStyles = "inline-flex items-center justify-center font-medium focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-[180ms] ease-in-out";

    const variants = {
        primary: "bg-[linear-gradient(135deg,var(--accent),var(--accent-secondary))] text-white shadow-[var(--shadow-accent)] hover:-translate-y-[1px] hover:shadow-[0_6px_20px_var(--accent-glow)] active:scale-[0.97]",
        secondary: "bg-[var(--bg-surface)] text-[var(--text-body)] border border-[var(--border-mid)] hover:border-[var(--border-accent)] hover:text-[var(--text-heading)] active:scale-[0.97]",
        outline: "bg-transparent border border-[var(--border-mid)] text-[var(--text-body)] hover:bg-[var(--accent-dim)] hover:border-[var(--border-accent)] hover:text-[var(--accent)] active:scale-[0.97]",
        ghost: "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-body)] active:scale-[0.97]",
        danger: "bg-[linear-gradient(135deg,#c4445a,#a8364c)] text-white shadow-[0_4px_16px_rgba(196,68,90,0.3)] hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(196,68,90,0.4)] active:scale-[0.97]",
        success: "bg-[linear-gradient(135deg,var(--color-success),var(--accent-secondary))] text-white shadow-[var(--shadow-accent)] hover:-translate-y-[1px] hover:shadow-[0_6px_20px_var(--accent-glow)] active:scale-[0.97]",
    };

    const sizes = {
        sm: "h-[30px] px-3 text-xs rounded-[var(--radius-md)]",
        md: "h-[36px] px-4 text-sm rounded-[var(--radius-lg)]",
        lg: "h-[42px] px-6 text-base rounded-[var(--radius-lg)]",
        icon: "h-[36px] w-[36px] p-0 text-lg rounded-[var(--radius-md)]",
    };

    const widthStyles = fullWidth ? "w-full" : "";

    return (
        <button
            ref={ref}
            className={`
                ${baseStyles}
                ${variants[variant]}
                ${sizes[size]}
                ${widthStyles}
                ${className}
            `}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {!isLoading && leftIcon && (
                <span className="mr-2">{leftIcon}</span>
            )}
            {children}
            {!isLoading && rightIcon && (
                <span className="ml-2">{rightIcon}</span>
            )}
        </button>
    );
});

Button.displayName = "Button";

export default Button;
