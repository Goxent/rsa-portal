import React from 'react';

interface StatCardProps {
    title: string;
    value: string | number;
    subtext?: string;
    icon: React.ElementType;
    trend?: string | number;
    trendIsNegative?: boolean;
    onClick?: () => void;
    delay?: number;
}

/**
 * Reusable statistics card with icon, value, and optional trend tracking
 */
const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subtext,
    icon: Icon,
    trend,
    trendIsNegative = false,
    onClick,
    delay = 0
}) => {
    return (
        <div
            onClick={onClick}
            className="group animate-fade-in-up transition-colors duration-150 hover:border-[var(--border-mid)]"
            style={{
                animationDelay: `${delay}ms`,
                cursor: onClick ? 'pointer' : 'default',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem 1.125rem 1.0625rem',
                boxShadow: 'var(--shadow-card)',
            }}
        >
            <div className="flex items-center justify-between gap-3">
                <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                    {title}
                </p>
                <Icon size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
            </div>

            <div className="flex items-baseline gap-2 mt-2.5">
                <span
                    className="font-display"
                    style={{
                        fontSize: '2rem',
                        fontWeight: 500,
                        color: 'var(--text-heading)',
                        letterSpacing: '-0.02em',
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {value}
                </span>

                {trend && (
                    <span
                        style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: trendIsNegative ? 'var(--color-danger)' : 'var(--accent)',
                        }}
                    >
                        {trendIsNegative ? '−' : '+'}{trend}%
                    </span>
                )}
            </div>

            {subtext && (
                <p className="mt-2 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {subtext}
                </p>
            )}
        </div>
    );
};

export default StatCard;
