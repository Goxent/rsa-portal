
import React from 'react';

interface StatCardProps {
    title: string;
    value: string | number;
    subtext?: string;
    icon: React.ElementType;
    gradient?: string;
    onClick?: () => void;
    delay?: number;
}

/**
 * Reusable statistics card with icon, value, and optional click handler
 */
const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subtext,
    icon: Icon,
    gradient = 'from-blue-600 to-indigo-600',
    onClick,
    delay = 0
}) => {
    return (
        <div
            onClick={onClick}
            className="glass-card p-6 hover:border-blue-500/20 cursor-pointer group animate-fade-in-up transition-all duration-300 hover:-translate-y-1"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                        {title}
                    </p>
                    <p className="text-3xl font-bold text-white font-heading mb-1 group-hover:text-blue-300 transition-colors">
                        {value}
                    </p>
                    {subtext && (
                        <p className="text-xs text-gray-400">
                            {subtext}
                        </p>
                    )}
                </div>
                <div className={`p-3 bg-gradient-to-br ${gradient} rounded-xl shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="text-white" size={24} />
                </div>
            </div>
        </div>
    );
};

export default StatCard;
