import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
    iconSize?: number;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    className = '',
    iconSize = 48
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center animate-fade-in-up ${className}`}>
            <div className={`p-4 bg-white/5 rounded-full mb-4 border border-white/5 shadow-inner`}>
                <Icon size={iconSize} className="text-gray-500 opacity-60" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6 leading-relaxed">
                {description}
            </p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="btn-primary flex items-center gap-2"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
