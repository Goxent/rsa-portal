import React from 'react';
import { Clock, Calendar, AlertTriangle } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';

const ComplianceCountdownWidget: React.FC = () => {
    // Mock deadlines logic (Replace with real data later)
    const getNextDeadline = () => {
        const today = new NepaliDate();
        const year = today.getYear();
        const month = today.getMonth(); // 0-11

        // VAT returns are usually due on the 25th of each Nepali month
        let deadlineDay = 25;
        let deadlineMonth = month;
        let deadlineYear = year;

        if (today.getDate() > 25) {
            deadlineMonth += 1;
            if (deadlineMonth > 11) {
                deadlineMonth = 0;
                deadlineYear += 1;
            }
        }

        const deadline = new NepaliDate(deadlineYear, deadlineMonth, deadlineDay);

        // Calculate days remaining roughly
        // NepaliDate doesn't have good diff methods, so we approximate or use JS dates for diff
        // For visual simplicity, let's just show the date and "Approaching"

        return {
            title: 'VAT Return Filing',
            date: deadline.format('DD MMMM YYYY'),
            daysLeft: deadline.getDate() - today.getDate() + (deadlineMonth - month) * 30 // Rough approx
        };
    };

    const nextDeadline = getNextDeadline();

    return (
        <div className="h-full flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-amber-400" />
                <h3 className="text-gray-300 font-medium text-sm">Next Compliance Deadline</h3>
            </div>

            <div className="text-center py-2">
                <p className="text-3xl font-bold text-white mb-1">{nextDeadline.daysLeft > 0 ? `${nextDeadline.daysLeft} Days` : 'Due Today'}</p>
                <p className="text-sm text-gray-400">Remaining</p>
            </div>

            <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium text-sm">{nextDeadline.title}</span>
                    <Calendar size={14} className="text-gray-400" />
                </div>
                <p className="text-xs text-brand-300">{nextDeadline.date}</p>
            </div>
        </div>
    );
};

export default ComplianceCountdownWidget;
