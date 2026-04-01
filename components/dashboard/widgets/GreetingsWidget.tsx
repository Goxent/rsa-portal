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
        <div
            className="relative rounded-2xl overflow-hidden glass-panel hover-lift"
            style={{
                background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(17,24,48,0.95) 100%)',
            }}
        >
            {/* CSS-only radial glow — no external URL */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle at 70% 50%, rgba(99,102,241,0.12) 0%, transparent 60%)',
                }}
            />
            {/* Subtle dot-grid pattern via CSS box-shadow trick */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.04]"
                style={{
                    backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                }}
            />

            {/* Content */}
            <div className="relative z-10 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">

                {/* Left: greeting text */}
                <div className="flex-1 min-w-0">
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                        className="flex items-center gap-3 mb-2"
                    >
                        <span className="text-xl">{greetingEmoji}</span>
                        <h1 className="text-2xl font-black text-white tracking-tight">
                            {greeting},{' '}
                            <span
                                className="bg-clip-text text-transparent"
                                style={{ backgroundImage: 'linear-gradient(90deg, #818cf8 0%, #c084fc 100%)' }}
                            >
                                {firstName}
                            </span>
                        </h1>
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                        className="text-gray-400 text-sm leading-relaxed max-w-md"
                    >
                        {subtitle}
                    </motion.p>
                </div>


            </div>
        </div>
    );
};

export default GreetingsWidget;
