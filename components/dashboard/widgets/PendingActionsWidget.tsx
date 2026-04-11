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
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-border group hover:border-accent/40 shadow-sm transition-all"
                >
                    <div className={`p-2 rounded-lg ${item.color.split(' ')[1]} transition-colors`}>
                        <item.icon size={14} className={item.color.split(' ')[0]} />
                    </div>
                    <div className="flex-1">
                        <span className="text-[12px] font-semibold text-muted group-hover:text-heading transition-colors">{item.label}</span>
                    </div>
                    <span className={`text-base font-bold tabular-nums ${item.count > 0 ? 'text-heading' : 'text-muted/40'}`}>
                        {item.count}
                    </span>
                </div>
            ))}

            <div className="pt-3 mt-1 border-t border-border/50 flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Aggregate Action</span>
                <span className={`text-lg font-black tabular-nums ${total > 0 ? 'text-accent' : 'text-muted/40'}`}>
                    {total}
                </span>
            </div>
        </div>
    );
};

export default PendingActionsWidget;
