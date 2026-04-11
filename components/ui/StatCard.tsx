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
            className={`cursor-pointer group animate-fade-in-up transition-all duration-200`}
            style={{ 
                animationDelay: `${delay}ms`,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.125rem 1.25rem',
                boxShadow: 'var(--shadow-card)',
            }}
            onMouseEnter={e => {
                const target = e.currentTarget;
                target.style.borderColor = 'var(--border-accent)';
                target.style.boxShadow = '0 4px 20px var(--accent-glow)';
                target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
                const target = e.currentTarget;
                target.style.borderColor = 'var(--border)';
                target.style.boxShadow = 'var(--shadow-card)';
                target.style.transform = 'translateY(0)';
            }}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <p 
                        className="uppercase"
                        style={{ 
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            color: 'var(--text-muted)',
                            marginBottom: '0.25rem'
                        }}
                    >
                        {title}
                    </p>
                    
                    <div className="flex items-baseline gap-2">
                        <h3 
                            style={{ 
                                fontSize: '1.625rem',
                                fontWeight: 700,
                                color: 'var(--text-heading)',
                                letterSpacing: '-0.03em',
                                lineHeight: 1
                            }}
                        >
                            {value}
                        </h3>
                        
                        {trend && (
                            <span 
                                style={{ 
                                    fontSize: '0.6875rem',
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: '99px',
                                    background: trendIsNegative 
                                        ? 'rgba(196,68,90,0.12)' 
                                        : 'rgba(101,154,43,0.15)',
                                    color: trendIsNegative 
                                        ? 'var(--color-danger)' 
                                        : 'var(--accent)'
                                }}
                            >
                                {trendIsNegative ? '-' : '+'}{trend}%
                            </span>
                        )}
                    </div>
                    
                    {subtext && (
                        <p className="mt-2 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {subtext}
                        </p>
                    )}
                </div>

                <div 
                    className="shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{ 
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--accent-dim)'
                    }}
                >
                    <Icon style={{ color: 'var(--accent)' }} size={18} />
                </div>
            </div>
        </div>
    );
};

export default StatCard;
