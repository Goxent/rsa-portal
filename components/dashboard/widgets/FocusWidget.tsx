import React, { useState, useEffect } from 'react';
import { Target, CheckCircle2, Circle, Edit2, X, Trophy, Plus } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { v4 as uuidv4 } from 'uuid';

interface Goal {
    id: string;
    text: string;
    completed: boolean;
}

const FocusWidget: React.FC = () => {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const { width, height } = useWindowSize();

    // Load from local storage
    useEffect(() => {
        const savedGoalsStr = localStorage.getItem('daily_goals');
        const savedDate = localStorage.getItem('daily_focus_date');
        const today = new Date().toLocaleDateString();

        if (savedDate === today) {
            if (savedGoalsStr) {
                try {
                    const parsed = JSON.parse(savedGoalsStr);
                    if (Array.isArray(parsed)) {
                        setGoals(parsed);
                    }
                } catch (e) {
                    console.error("Failed to parse goals", e);
                }
            }
        } else {
            // New day, clear old goals
            localStorage.removeItem('daily_goals');
            localStorage.setItem('daily_focus_date', today);
        }
    }, []);

    const saveToStorage = (newGoals: Goal[]) => {
        setGoals(newGoals);
        localStorage.setItem('daily_goals', JSON.stringify(newGoals));
        localStorage.setItem('daily_focus_date', new Date().toLocaleDateString());
    };

    const handleAddGoal = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        const newGoal: Goal = {
            id: uuidv4(),
            text: inputValue.trim(),
            completed: false
        };

        saveToStorage([...goals, newGoal]);
        setInputValue('');
        setIsEditing(false);
    };

    const toggleGoal = (id: string) => {
        const newGoals = goals.map(g => {
            if (g.id === id) {
                const isNowCompleted = !g.completed;
                if (isNowCompleted) {
                    setShowConfetti(true);
                    setTimeout(() => setShowConfetti(false), 5000);
                }
                return { ...g, completed: isNowCompleted };
            }
            return g;
        });
        saveToStorage(newGoals);
    };

    const deleteGoal = (id: string) => {
        saveToStorage(goals.filter(g => g.id !== id));
    };

    const clearAllGoals = () => {
        saveToStorage([]);
        setIsEditing(true);
    };

    const allCompleted = goals.length > 0 && goals.every(g => g.completed);

    return (
        <div className="relative glass-panel rounded-2xl border border-white/5 p-6 overflow-hidden min-h-[140px] flex flex-col justify-start transition-all hover:border-brand-500/20 group">
            {showConfetti && <Confetti width={width} height={height} numberOfPieces={200} recycle={false} />}

            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(!isEditing)} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title="Add Goal">
                        <Plus size={14} />
                    </button>
                    {goals.length > 0 && (
                        <button onClick={clearAllGoals} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors" title="Clear All">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${allCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-brand-500/20 text-brand-400'}`}>
                    {allCompleted ? <Trophy size={18} /> : <Target size={18} />}
                </div>
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">
                    {allCompleted ? 'All Daily Goals Achieved!' : 'Main Focus for Today'}
                </h3>
            </div>

            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-2 flex-grow">
                {goals.map(goal => (
                    <div key={goal.id} className="flex items-start gap-3 group/item">
                        <button onClick={() => toggleGoal(goal.id)} className={`mt-1 shrink-0 transition-all duration-300 ${goal.completed ? 'text-emerald-400 scale-110' : 'text-gray-500 hover:text-brand-400'}`}>
                            {goal.completed ? <CheckCircle2 size={20} className="fill-emerald-500/20" /> : <Circle size={20} />}
                        </button>
                        <p onClick={() => toggleGoal(goal.id)} className={`text-base font-semibold cursor-pointer transition-all duration-300 flex-1 ${goal.completed ? 'text-emerald-400/50 line-through decoration-2 decoration-emerald-500/50' : 'text-white hover:text-gray-200'}`}>
                            {goal.text}
                        </p>
                        <button onClick={() => deleteGoal(goal.id)} className="opacity-0 group-hover/item:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all ml-auto shrink-0">
                            <X size={14} />
                        </button>
                    </div>
                ))}

                {(isEditing || goals.length === 0) && (
                    <form onSubmit={handleAddGoal} className="mt-1 flex items-center gap-2">
                        <Circle size={20} className="text-gray-600 shrink-0 mt-0.5" />
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Add a new priority..."
                            className="flex-1 bg-transparent border-b border-white/10 text-base font-semibold text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors py-1"
                            autoFocus
                        />
                    </form>
                )}
            </div>
        </div>
    );
};

export default FocusWidget;
