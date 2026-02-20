
import React, { useState, useEffect } from 'react';
import { Target, CheckCircle2, Circle, Edit2, X, Trophy } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

const FocusWidget: React.FC = () => {
    const [focus, setFocus] = useState('');
    const [isEditing, setIsEditing] = useState(true);
    const [isCompleted, setIsCompleted] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const { width, height } = useWindowSize();

    // Load from local storage
    useEffect(() => {
        const savedFocus = localStorage.getItem('daily_focus');
        const savedDate = localStorage.getItem('daily_focus_date');
        const savedCompleted = localStorage.getItem('daily_focus_completed');
        const today = new Date().toLocaleDateString();

        if (savedFocus && savedDate === today) {
            setFocus(savedFocus);
            setIsEditing(false);
            if (savedCompleted === 'true') {
                setIsCompleted(true);
            }
        }
    }, []);

    const handleSave = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!focus.trim()) return;

        localStorage.setItem('daily_focus', focus);
        localStorage.setItem('daily_focus_date', new Date().toLocaleDateString());
        localStorage.setItem('daily_focus_completed', 'false');
        setIsEditing(false);
        setIsCompleted(false);
    };

    const handleComplete = () => {
        const newState = !isCompleted;
        setIsCompleted(newState);
        localStorage.setItem('daily_focus_completed', String(newState));

        if (newState) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
        }
    };

    const clearFocus = () => {
        setFocus('');
        setIsEditing(true);
        setIsCompleted(false);
        localStorage.removeItem('daily_focus');
        localStorage.removeItem('daily_focus_date');
        localStorage.removeItem('daily_focus_completed');
    };

    return (
        <div className="relative glass-panel rounded-2xl border border-white/5 p-6 overflow-hidden min-h-[140px] flex flex-col justify-center transition-all hover:border-brand-500/20 group">
            {showConfetti && <Confetti width={width} height={height} numberOfPieces={200} recycle={false} />}

            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isEditing && (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditing(true)} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <Edit2 size={14} />
                        </button>
                        <button onClick={clearFocus} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-500/20 text-brand-400'}`}>
                    {isCompleted ? <Trophy size={18} /> : <Target size={18} />}
                </div>
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">
                    {isCompleted ? 'Daily Goal Achieved!' : 'Main Focus for Today'}
                </h3>
            </div>

            {isEditing ? (
                <form onSubmit={handleSave} className="mt-2">
                    <input
                        type="text"
                        value={focus}
                        onChange={(e) => setFocus(e.target.value)}
                        placeholder="What is your absolute priority today?"
                        className="w-full bg-transparent border-b-2 border-white/10 text-xl md:text-2xl font-bold text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors pb-2"
                        autoFocus
                    />
                </form>
            ) : (
                <div className="mt-2 flex items-start gap-3 group/text cursor-pointer" onClick={handleComplete}>
                    <button className={`mt-1 transition-all duration-300 ${isCompleted ? 'text-emerald-400 scale-110' : 'text-gray-500 group-hover/text:text-brand-400'}`}>
                        {isCompleted ? <CheckCircle2 size={24} className="fill-emerald-500/20" /> : <Circle size={24} />}
                    </button>
                    <p className={`text-xl md:text-2xl font-bold transition-all duration-300 ${isCompleted ? 'text-emerald-400/50 line-through decoration-2 decoration-emerald-500/50' : 'text-white'}`}>
                        {focus}
                    </p>
                </div>
            )}
        </div>
    );
};

export default FocusWidget;
