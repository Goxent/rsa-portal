
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
    const baseClasses = 'glass-panel';
    const hoverClasses = hoverEffect
        ? 'hover:border-[var(--border-mid)] hover:bg-[var(--bg-surface)] transition-colors duration-150 cursor-pointer'
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
