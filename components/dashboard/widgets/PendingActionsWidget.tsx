import React from 'react';
import { Clock, FileText, DollarSign, Mail } from 'lucide-react';

interface PendingActionsWidgetProps {
    pendingActions?: {
        invoices: number;
        documents: number;
        signatures: number;
        emails: number;
    };
}

const PendingActionsWidget: React.FC<PendingActionsWidgetProps> = ({
    pendingActions = { invoices: 0, documents: 0, signatures: 0, emails: 0 }
}) => {
    const items = [
        { icon: DollarSign, label: 'Invoices', count: pendingActions.invoices, color: 'text-status-completed bg-status-completed-dim' },
        { icon: FileText, label: 'Documents', count: pendingActions.documents, color: 'text-status-pending bg-status-pending-dim' },
        { icon: Mail, label: 'Emails', count: pendingActions.emails, color: 'text-accent bg-accent/10' },
    ];

    const total = items.reduce((sum, item) => sum + item.count, 0);

    return (
        <div className="space-y-2 py-1">
            {items.map((item) => (
                <div
                    key={item.label}
                    className="flex items-center gap-3 p-2.5 rounded-[var(--radius-md)] border transition-colors duration-150 hover:border-[var(--border-mid)]"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                >
                    <div className={`p-2 rounded-[var(--radius-sm)] ${item.color.split(' ')[1]} transition-colors`}>
                        <item.icon size={14} strokeWidth={1.75} className={item.color.split(' ')[0]} />
                    </div>
                    <div className="flex-1">
                        <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: item.count > 0 ? 'var(--text-heading)' : 'var(--text-muted)' }}>
                        {item.count}
                    </span>
                </div>
            ))}

            <div className="pt-2.5 mt-1 border-t flex justify-between items-center px-1" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Total pending</span>
                <span className="font-display text-lg font-medium tabular-nums" style={{ color: total > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {total}
                </span>
            </div>
        </div>
    );
};

export default PendingActionsWidget;
