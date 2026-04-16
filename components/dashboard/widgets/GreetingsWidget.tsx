import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Clock, CalendarDays, Quote } from 'lucide-react';
import { toBS } from '../../../utils/dates';
import { motion, AnimatePresence } from 'framer-motion';

interface GreetingsWidgetProps {
    pendingCount?: number;
    completedToday?: number;
}

const MOTIVATIONAL_QUOTES = [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
    { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
    { text: "Success is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Everything you’ve ever wanted is on the other side of fear.", author: "George Addair" },
    { text: "Hardships often prepare ordinary people for an extraordinary destiny.", author: "C.S. Lewis" },
    { text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "F.D. Roosevelt" },
    { text: "Act as if what you do makes a difference. It does.", author: "William James" },
    { text: "Work hard in silence, let your success be your noise.", author: "Frank Ocean" },
    { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
    { text: "The mind is everything. What you think you become.", author: "Buddha" },
    { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
    { text: "Your time is limited, so don't waste it living someone else's life.", author: "Steve Jobs" },
    { text: "Stay hungry, stay foolish.", author: "Stewart Brand" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Whether you think you can or you think you can’t, you’re right.", author: "Henry Ford" },
    { text: "Perfection is not attainable, but if we chase it we can catch excellence.", author: "Vince Lombardi" },
    { text: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson" },
    { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
    { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { text: "Don't let yesterday take up too much of today.", author: "Will Rogers" },
    { text: "You learn more from failure than from success. Don’t let it stop you.", author: "Unknown" },
    { text: "If you care about something, the vision pulls you.", author: "Steve Jobs" },
    { text: "People crazy enough to think they can change the world are the ones who do.", author: "Rob Siltanen" },
    { text: "Failure will never overtake me if my determination to succeed is strong.", author: "Og Mandino" },
    { text: "Optimism is the faith that leads to achievement.", author: "Helen Keller" },
    { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
    { text: "Keep your face toward the sunshine—and shadows will fall behind you.", author: "Walt Disney" }
];

const GreetingsWidget: React.FC<GreetingsWidgetProps> = ({
    pendingCount,
    completedToday,
}) => {
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [randomQuote, setRandomQuote] = useState(MOTIVATIONAL_QUOTES[0]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        
        // Consistent Quote of the Day: Unique per user, stable for the day
        const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const userHashStr = user?.uid || user?.email || 'guest';
        const combinedStr = `${dateStr}-${userHashStr}`;
        
        let seed = 0;
        for (let i = 0; i < combinedStr.length; i++) {
            seed += combinedStr.charCodeAt(i);
        }
        
        const quoteIndex = seed % MOTIVATIONAL_QUOTES.length;
        setRandomQuote(MOTIVATIONAL_QUOTES[quoteIndex]);
        
        return () => clearInterval(timer);
    }, [user?.uid, user?.email]);

    const hour = currentTime.getHours();

    const greeting = useMemo(() => {
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    }, [hour]);

    const greetingEmoji = hour < 12 ? '🌤️' : hour < 17 ? '☀️' : '🌙';

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
        const done = completedToday ?? 0;
        return done > 0
            ? `Great work today. ${done} task${done !== 1 ? 's' : ''} completed this week.`
            : 'Wrap up any remaining work. Tomorrow is a fresh start.';
    }, [hour, pendingCount, completedToday]);

    const firstName = user?.displayName?.split(' ')[0] ?? 'Explorer';

    return (
        <div className="relative glass-card dotted-grid overflow-hidden min-h-[160px] flex items-center group transition-all duration-500 hover:shadow-2xl hover:shadow-accent/5">
            {/* Themed radial glow behind content */}
            <div
                className="absolute inset-0 pointer-events-none opacity-40 transition-opacity duration-1000 group-hover:opacity-60"
                style={{
                    backgroundImage: `radial-gradient(circle at 85% 50%, ${hour < 12 ? 'rgba(101,154,43,0.15)' : 'rgba(59,130,246,0.15)'} 0%, transparent 70%)`,
                }}
            />

            {/* Content */}
            <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 w-full">
                <div className="flex flex-col gap-2">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="flex items-center gap-3.5"
                    >
                        <span className="text-3xl drop-shadow-md select-none">{greetingEmoji}</span>
                        <h1 className="text-2xl md:text-3xl font-black text-heading tracking-tight leading-none bg-clip-text">
                            {greeting}, <span className="text-accent drop-shadow-[0_0_15px_var(--accent-glow)]">{firstName}</span>
                        </h1>
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-muted text-sm font-semibold tracking-tight mt-1 opacity-90 max-w-md"
                    >
                        {subtitle}
                    </motion.p>
                </div>

                {/* Quote Section */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="relative max-w-xs bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-2xl hidden sm:block group/quote hover:bg-white/10 transition-colors"
                >
                    <Quote size={16} className="text-accent mb-2 opacity-50" />
                    <p className="text-xs italic text-heading font-medium leading-relaxed">
                        "{randomQuote.text}"
                    </p>
                    <p className="text-[10px] text-muted mt-2 font-bold tracking-widest uppercase">
                        — {randomQuote.author}
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default GreetingsWidget;

