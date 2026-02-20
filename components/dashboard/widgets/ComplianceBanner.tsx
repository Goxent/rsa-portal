
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

    if (urgentDeadlines.length === 0) return null;

    return (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-red-900/40 to-orange-900/40 border border-red-500/20 p-4 animate-in slide-in-from-top-4 duration-500">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-500/20 rounded-xl text-red-400 shrink-0">
                        <AlertTriangle size={24} className="animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Compliance Alert</h3>
                        <p className="text-sm text-gray-300">
                            You have <span className="font-bold text-red-400">{urgentDeadlines.length} urgent deadlines</span> approaching this week.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                    {urgentDeadlines.map(d => (
                        <div key={d.id} className="flex items-center gap-3 bg-black/20 px-3 py-2 rounded-lg border border-white/5 hover:bg-black/30 transition-colors">
                            <Calendar size={14} className="text-gray-400" />
                            <span className="text-sm text-white font-medium truncate max-w-[200px]">{d.title}</span>
                            <span className="text-xs text-red-400 font-mono ml-auto bg-red-500/10 px-1.5 py-0.5 rounded">
                                {d.date}
                            </span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => navigate('/compliance')}
                    className="group whitespace-nowrap flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-bold transition-all"
                >
                    View Compliance
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
};

export default ComplianceBanner;
