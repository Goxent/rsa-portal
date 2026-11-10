import React from 'react';

export interface RSALogoProps {
    className?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    themeOverride?: 'light' | 'dark';
    alt?: string;
    style?: React.CSSProperties;
    animated?: boolean;
}

const RSALogo: React.FC<RSALogoProps> = ({ 
    className = '', 
    size = 'md',
    themeOverride,
    alt = 'R. Sapkota & Associates',
    style,
    animated = false
}) => {
    const sizeMap = {
        xs: 'w-6 h-6 rounded-md',
        sm: 'w-8 h-8 rounded-lg',
        md: 'w-12 h-12 rounded-xl',
        lg: 'w-20 h-20 rounded-2xl',
        xl: 'w-28 h-28 rounded-2xl',
        '2xl': 'w-36 h-36 rounded-3xl'
    };

    return (
        <div 
            className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none ${sizeMap[size] || sizeMap.md} ${animated ? 'transition-transform duration-300 hover:scale-105' : ''} ${className}`}
            style={style}
        >
            {themeOverride === 'dark' ? (
                <img 
                    src="/rsa-logo-dark.png" 
                    alt={alt} 
                    className="w-full h-full object-contain pointer-events-none" 
                    loading="eager"
                />
            ) : themeOverride === 'light' ? (
                <img 
                    src="/rsa-logo-light.png" 
                    alt={alt} 
                    className="w-full h-full object-contain pointer-events-none" 
                    loading="eager"
                />
            ) : (
                <>
                    <img 
                        src="/rsa-logo-light.png" 
                        alt={alt} 
                        className="block dark:hidden w-full h-full object-contain pointer-events-none" 
                        loading="eager"
                    />
                    <img 
                        src="/rsa-logo-dark.png" 
                        alt={alt} 
                        className="hidden dark:block w-full h-full object-contain pointer-events-none" 
                        loading="eager"
                    />
                </>
            )}
        </div>
    );
};

export default RSALogo;
