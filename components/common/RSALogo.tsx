import React from 'react';

interface RSALogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    animated?: boolean;
}

const RSALogo: React.FC<RSALogoProps> = ({ 
    className = '', 
    size = 'md',
    animated = false
}) => {
    const sizeMap = {
        sm: 'w-8 h-8 text-[12px]',
        md: 'w-12 h-10 text-[14px]',
        lg: 'w-24 h-20 text-[24px]',
        xl: 'w-32 h-28 text-[32px]'
    };

    const containerClasses = `
        relative flex items-center justify-center 
        bg-gradient-to-br from-brand-600 to-brand-400 
        dark:from-brand-500 dark:to-brand-700
        rounded-[12px] shadow-lg overflow-hidden
        border border-white/20
        ${sizeMap[size]}
        ${animated ? 'animate-logo-reveal' : ''}
        ${className}
    `;

    return (
        <div className={containerClasses}>
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
            
            {/* Brand Text */}
            <span className="relative z-10 font-black tracking-widest text-white drop-shadow-md">
                RSA
            </span>

            {/* Subtle Animated Shimmer */}
            <div 
                className="absolute inset-x-[-100%] top-0 h-full w-[200%] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-30 transform -skew-x-[30deg]"
                style={{ 
                    animation: animated ? 'logo-shimmer 3s infinite linear' : 'none'
                }}
            />
            
            {/* Inner Glow */}
            <div className="absolute inset-[2px] rounded-[10px] border border-white/5 pointer-events-none" />
        </div>
    );
};

export default RSALogo;
