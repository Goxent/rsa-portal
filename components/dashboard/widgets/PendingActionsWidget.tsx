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
        { icon: DollarSign, label: 'Invoices', count: pendingActions.invoices, color: 'text-green-400 bg-green-500/20' },
        { icon: FileText, label: 'Documents', count: pendingActions.documents, color: 'text-amber-400 bg-amber-500/20' },
        { icon: Mail, label: 'Emails', count: pendingActions.emails, color: 'text-purple-400 bg-purple-500/20' },
    ];

    const total = items.reduce((sum, item) => sum + item.count, 0);

    return (
        <div className="space-y-3">
            {items.map((item) => (
                <div
                    key={item.label}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <div className={`p-2 rounded-lg ${item.color.split(' ')[1]}`}>
                        <item.icon size={16} className={item.color.split(' ')[0]} />
                    </div>
                    <div className="flex-1">
                        <span className="text-sm text-gray-300">{item.label}</span>
                    </div>
                    <span className={`text-lg font-bold ${item.count > 0 ? 'text-white' : 'text-gray-500'}`}>
                        {item.count}
                    </span>
                </div>
            ))}

            <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                <span className="text-sm text-gray-400">Total pending</span>
                <span className={`text-xl font-bold ${total > 0 ? 'text-brand-400' : 'text-gray-500'}`}>
                    {total}
                </span>
            </div>
        </div>
    );
};

export default PendingActionsWidget;
