import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Clock, CalendarDays } from 'lucide-react';
import { toBS } from '../../../utils/dates';
import { motion } from 'framer-motion';

interface GreetingsWidgetProps {
    pendingCount?: number;
    completedToday?: number;
}

const GreetingsWidget: React.FC<GreetingsWidgetProps> = ({
    pendingCount,
    completedToday,
}) => {
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const hour = currentTime.getHours();

    const greeting = useMemo(() => {
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    }, [hour]);

    const greetingEmoji = hour < 12 ? '🌤️' : hour < 17 ? '☀️' : '🌙';

    // Dynamic subtitle based on time + data
    const subtitle = useMemo(() => {
        const hasData = pendingCount !== undefined || completedToday !== undefined;
        if (!hasData) return 'Your workspace is ready. Start by checking your tasks.';
        if (hour < 12) {
            const due = pendingCount ?? 0;
            return due > 0
                ? `You have ${due} task${due !== 1 ? 's' : ''} due this week. Let's make progress.`
                : 'No pending tasks this week. Great job staying on top! 🎉';
        }
        if (hour < 17) {
            const done = completedToday ?? 0;
            const pending = pendingCount ?? 0;
            return done > 0
                ? `${done} task${done !== 1 ? 's' : ''} completed today. ${pending > 0 ? `${pending} still pending.` : 'All clear!'}`
                : `${pending > 0 ? `${pending} task${pending !== 1 ? 's' : ''} pending. Keep going!` : 'No tasks pending — you\'re ahead of schedule.'}`;
        }
        // Evening
        const done = completedToday ?? 0;
        return done > 0
            ? `Great work today. ${done} task${done !== 1 ? 's' : ''} completed this week.`
            : 'Wrap up any remaining work. Tomorrow is a fresh start.';
    }, [hour, pendingCount, completedToday]);


    const firstName = user?.displayName?.split(' ')[0] ?? '';

    return (
        <div className="relative glass-card dotted-grid overflow-hidden min-h-[140px] flex items-center group">
            {/* Themed radial glow behind content */}
            <div
                className="absolute inset-0 pointer-events-none opacity-60 transition-opacity duration-1000 group-hover:opacity-80"
                style={{
                    backgroundImage: 'radial-gradient(circle at 85% 50%, rgba(101,154,43,0.18) 0%, transparent 65%)',
                }}
            />

            {/* Content */}
            <div className="relative z-10 p-7 flex flex-col justify-center gap-2 w-full">
                <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="flex items-center gap-3.5"
                >
                    <span className="text-2xl drop-shadow-md select-none">{greetingEmoji}</span>
                    <h1 className="text-[1.75rem] font-black text-heading tracking-tight leading-none">
                        {greeting}, <span className="text-accent drop-shadow-[0_0_12px_var(--accent-glow)]">{firstName}</span>
                    </h1>
                </motion.div>

                <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-muted text-[13px] font-bold tracking-tight mt-1 opacity-90"
                >
                    {subtitle}
                </motion.p>
            </div>
        </div>
    );
};

export default GreetingsWidget;
