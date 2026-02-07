
import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    hoverEffect?: boolean;
}

/**
 * Reusable glass-effect card component with consistent styling
 */
const GlassCard: React.FC<GlassCardProps> = ({
    children,
    className = '',
    onClick,
    hoverEffect = false
}) => {
    const baseClasses = 'glass-panel rounded-xl';
    const hoverClasses = hoverEffect
        ? 'hover:border-blue-500/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer'
        : '';

    return (
        <div
            className={`${baseClasses} ${hoverClasses} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

export default GlassCard;
