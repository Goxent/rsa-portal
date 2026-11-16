
import React from 'react';
import { AlertTriangle, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ComplianceBannerProps {
    deadlines: {
        id: string;
        title: string;
        date: string;
        subType?: string;
    }[];
}

const ComplianceBanner: React.FC<ComplianceBannerProps> = ({ deadlines }) => {
    const navigate = useNavigate();

    // Filter for urgent deadlines (due within 7 days)
    const now = new Date();
    const urgentThreshold = new Date();
    urgentThreshold.setDate(now.getDate() + 7);

    const urgentDeadlines = deadlines.filter(d => {
        const dueDate = new Date(d.date);
        return dueDate >= now && dueDate <= urgentThreshold;
    }).slice(0, 3); // Show top 3

    if (!deadlines || deadlines.length === 0 || urgentDeadlines.length === 0) {
        return null;
    }

    return (
        <div
            className="relative mt-2 rounded-[var(--radius-lg)] border p-4 transition-colors duration-150"
            style={{
                background: 'var(--bg-secondary)',
                borderColor: 'rgba(224,112,122,0.3)',
                borderLeftWidth: '3px',
                borderLeftColor: 'var(--color-danger)'
            }}
        >
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-[var(--radius-sm)] shrink-0" style={{ background: 'rgba(224,112,122,0.1)', color: 'var(--color-danger)' }}>
                        <AlertTriangle size={18} strokeWidth={1.75} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>Compliance alert</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            You have <span className="font-semibold" style={{ color: 'var(--color-danger)' }}>{urgentDeadlines.length} urgent deadlines</span> approaching this week.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 w-full md:w-auto">
                    {urgentDeadlines.map(d => (
                        <div key={d.id} className="flex items-center gap-2.5 px-3 py-1.5 rounded-[var(--radius-sm)] border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                            <Calendar size={13} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
                            <span className="text-xs font-medium truncate max-w-[200px]" style={{ color: 'var(--text-heading)' }}>{d.title}</span>
                            <span className="text-[11px] font-mono tabular-nums ml-auto px-1.5 py-0.5 rounded-[var(--radius-sm)]" style={{ background: 'rgba(224,112,122,0.1)', color: 'var(--color-danger)' }}>
                                {d.date}
                            </span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => navigate('/compliance')}
                    className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border text-xs font-semibold transition-colors shrink-0"
                    style={{
                        background: 'rgba(224,112,122,0.08)',
                        borderColor: 'rgba(224,112,122,0.3)',
                        color: 'var(--color-danger)'
                    }}
                >
                    View compliance
                    <ChevronRight size={14} strokeWidth={1.75} />
                </button>
            </div>
        </div>
    );
};

export default ComplianceBanner;
