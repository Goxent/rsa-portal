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

    const baseStyles = "inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-900 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";

    const variants = {
        primary: "bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white shadow-lg hover:shadow-brand-500/20 focus:ring-brand-500",
        secondary: "bg-white/10 hover:bg-white/15 text-white border border-white/10 hover:border-white/20 focus:ring-gray-500",
        outline: "bg-transparent border border-white/20 hover:bg-white/5 text-gray-300 hover:text-white focus:ring-gray-500",
        ghost: "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white focus:ring-gray-500",
        danger: "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg hover:shadow-red-500/20 focus:ring-red-500",
        success: "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg hover:shadow-emerald-500/20 focus:ring-emerald-500",
    };

    const sizes = {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 p-0 text-lg",
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
