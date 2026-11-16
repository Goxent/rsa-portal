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

    const baseStyles = "inline-flex items-center justify-center font-medium focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-out";

    const variants = {
        primary: "bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] active:translate-y-[0.5px]",
        secondary: "bg-[var(--bg-secondary)] text-[var(--text-heading)] border border-[var(--border-mid)] hover:bg-[var(--bg-surface)] active:translate-y-[0.5px]",
        outline: "bg-transparent border border-[var(--border-mid)] text-[var(--text-body)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-heading)] active:translate-y-[0.5px]",
        ghost: "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-heading)] active:translate-y-[0.5px]",
        danger: "bg-[var(--color-danger)] text-white hover:brightness-110 active:translate-y-[0.5px]",
        success: "bg-[var(--color-success)] text-[var(--on-accent)] hover:brightness-110 active:translate-y-[0.5px]"
    };

    const sizes = {
        sm: "h-[30px] px-3 text-xs rounded-[var(--radius-md)]",
        md: "h-[36px] px-4 text-sm rounded-[var(--radius-md)]",
        lg: "h-[42px] px-6 text-[0.9375rem] rounded-[var(--radius-md)]",
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
