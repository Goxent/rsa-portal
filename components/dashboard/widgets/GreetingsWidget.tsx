
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { Sun, Moon, Clock, CalendarDays } from 'lucide-react';
import { toBS } from '../../../utils/dateUtils';

const GreetingsWidget: React.FC = () => {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [greeting, setGreeting] = useState('');

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);

            const hour = now.getHours();
            if (hour < 12) setGreeting('Good Morning');
            else if (hour < 17) setGreeting('Good Afternoon');
            else setGreeting('Good Evening');
        }, 1000);

        // Initial set
        const now = new Date();
        const hour = now.getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 17) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-navy-800 to-brand-900 shadow-2xl border border-white/10 animate-fade-in group">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-brand-600/10 to-accent-purple/10"></div>

            <div className="relative p-6 flex flex-col lg:flex-row justify-between items-center z-10 gap-6">
                <div className="flex-1 w-full lg:w-auto text-center lg:text-left">
                    <div className="flex items-center justify-center lg:justify-start gap-4 mb-2">
                        <h1 className="text-2xl md:text-3xl font-bold text-white font-heading tracking-tight">
                            {greeting}, <span className="text-brand-500 bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-accent-purple animate-gradient">{user?.displayName?.split(' ')[0]}</span>
                        </h1>
                        <span className="text-2xl animate-bounce-slow">👋</span>
                        {/* Mobile Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="lg:hidden p-2 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:text-white transition-all ml-auto"
                        >
                            {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-blue-400" />}
                        </button>
                    </div>
                    <p className="text-gray-400 text-sm max-w-xl mx-auto lg:mx-0">
                        Ready to conquer the day? You have complete control over your workspace.
                    </p>
                </div>

                <div className="flex flex-wrap items-center justify-center lg:justify-end gap-3 w-full lg:w-auto">
                    {/* Digital Clock */}
                    <div className="glass-panel px-4 py-3 rounded-xl flex items-center gap-3 border border-white/5 bg-black/20 hover:bg-black/30 transition-colors group/clock">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 group-hover/clock:scale-110 transition-transform">
                            <Clock size={20} />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Local Time</p>
                            <p className="text-white font-mono text-lg font-bold leading-none">
                                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                        </div>
                    </div>

                    {/* Date (AD/BS) */}
                    <div className="glass-panel px-4 py-3 rounded-xl flex items-center gap-3 border border-white/5 bg-black/20 hover:bg-black/30 transition-colors group/date">
                        <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400 group-hover/date:scale-110 transition-transform">
                            <CalendarDays size={20} />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Date (AD / BS)</p>
                            <p className="text-white font-medium text-sm leading-none mt-1">{currentTime.toLocaleDateString()} <span className="text-gray-500 mx-1">|</span> {toBS(currentTime)}</p>
                        </div>
                    </div>

                    {/* Desktop Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="hidden lg:flex p-4 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white transition-all hover:bg-white/10 hover:-translate-y-1 shadow-lg group/theme"
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? <Sun size={20} className="text-amber-400 group-hover/theme:rotate-90 transition-transform duration-500" /> : <Moon size={20} className="text-blue-400 group-hover/theme:-rotate-12 transition-transform" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GreetingsWidget;
