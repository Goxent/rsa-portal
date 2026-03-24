import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Target, Trophy, X, Plus, Check } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

// ── CSS celebration keyframes injected once ───────────────────────────────────
const CELEBRATION_STYLE = `
@keyframes fw-pop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.35); }
    70%  { transform: scale(0.92); }
    100% { transform: scale(1); }
}
.fw-pop { animation: fw-pop 0.35s ease-out forwards; }
`;

let styleInjected = false;
function injectStyle() {
    if (styleInjected || typeof document === 'undefined') return;
    const el = document.createElement('style');
    el.textContent = CELEBRATION_STYLE;
    document.head.appendChild(el);
    styleInjected = true;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Goal {
    id: string;
    text: string;
    completed: boolean;
}

const STORAGE_KEY_GOALS = 'daily_goals';
const STORAGE_KEY_DATE = 'daily_focus_date';
const MAX_GOALS = 5;

// ── Component ─────────────────────────────────────────────────────────────────
const FocusWidget: React.FC = () => {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [inputFocused, setInputFocused] = useState(false);
    const [celebratingId, setCelebratingId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Inject CSS once on mount
    useEffect(() => { injectStyle(); }, []);

    // Load from localStorage — ISO date guard
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const savedDate = localStorage.getItem(STORAGE_KEY_DATE);

        if (savedDate === today) {
            try {
                const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY_GOALS) ?? '[]');
                if (Array.isArray(parsed)) setGoals(parsed);
            } catch { /* ignore */ }
        } else {
            // New day — reset
            localStorage.removeItem(STORAGE_KEY_GOALS);
            localStorage.setItem(STORAGE_KEY_DATE, today);
            setGoals([]);
        }
    }, []);

    const persist = useCallback((next: Goal[]) => {
        setGoals(next);
        localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(next));
        localStorage.setItem(STORAGE_KEY_DATE, new Date().toISOString().split('T')[0]);
    }, []);

    const handleAddGoal = (e?: React.FormEvent) => {
        e?.preventDefault();
        const text = inputValue.trim();
        if (!text || goals.length >= MAX_GOALS) return;
        persist([...goals, { id: uuidv4(), text, completed: false }]);
        setInputValue('');
        // keep focus in the input for rapid entry
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const toggleGoal = (id: string) => {
        const next = goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g);
        const goal = next.find(g => g.id === id);
        persist(next);

        if (goal?.completed) {
            // Lightweight CSS pop celebration
            setCelebratingId(id);
            setTimeout(() => setCelebratingId(null), 400);

            // Toast — check if all done after this toggle
            const allDone = next.every(g => g.completed);
            if (allDone) {
                toast.success('🎯 All focus goals complete!', { duration: 3000 });
            } else {
                toast('✓ Done!', {
                    duration: 1500,
                    style: { background: '#1e293b', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', fontSize: '13px' }
                });
            }
        }
    };

    const deleteGoal = (id: string) => {
        persist(goals.filter(g => g.id !== id));
    };

    const completedCount = goals.filter(g => g.completed).length;
    const allCompleted = goals.length > 0 && completedCount === goals.length;
    const progress = goals.length > 0 ? (completedCount / goals.length) * 100 : 0;
    const atLimit = goals.length >= MAX_GOALS;

    return (
        <div className="relative glass-panel hover-lift rounded-2xl border border-white/[0.07] p-5 flex flex-col gap-3 h-full min-h-[140px]">

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg flex-shrink-0 ${allCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {allCompleted ? <Trophy size={15} /> : <Target size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest truncate">
                            Today's Focus
                        </h3>
                        <span className="text-[10px] font-bold text-gray-500 flex-shrink-0 tabular-nums">
                            {completedCount}/{goals.length} done
                        </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${progress}%`,
                                background: allCompleted
                                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                                    : 'linear-gradient(90deg, #6366f1, #818cf8)',
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* ── All-done celebration state ──────────────────────────── */}
            {allCompleted ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
                    <p className="text-2xl">🎯</p>
                    <p className="text-sm font-bold text-emerald-400">All done! Great focus today.</p>
                    <button
                        onClick={() => persist([])}
                        className="mt-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
                    >
                        Reset for tomorrow
                    </button>
                </div>
            ) : (
                <>
                    {/* ── Goal list ──────────────────────────────────────── */}
                    <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto custom-scrollbar">
                        {goals.map(goal => (
                            <div
                                key={goal.id}
                                className="flex items-center gap-2.5 group/item rounded-lg px-1.5 py-1 hover:bg-white/[0.03] transition-colors"
                            >
                                {/* Custom checkbox */}
                                <div
                                    onClick={() => toggleGoal(goal.id)}
                                    className={`
                                        w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center
                                        cursor-pointer flex-shrink-0 transition-all duration-200
                                        ${celebratingId === goal.id ? 'fw-pop' : ''}
                                        ${goal.completed
                                            ? 'bg-emerald-500 border-emerald-500'
                                            : 'border-slate-600 bg-transparent hover:border-indigo-400'}
                                    `}
                                >
                                    {goal.completed && (
                                        <Check size={11} className="text-white" strokeWidth={3} />
                                    )}
                                </div>

                                {/* Goal text */}
                                <p
                                    onClick={() => toggleGoal(goal.id)}
                                    className={`flex-1 text-sm cursor-pointer transition-all duration-200 truncate leading-none ${goal.completed
                                            ? 'text-gray-500 line-through decoration-gray-600'
                                            : 'text-gray-200 hover:text-white'
                                        }`}
                                    title={goal.text}
                                >
                                    {goal.text}
                                </p>

                                {/* Delete — hover only */}
                                <button
                                    onClick={() => deleteGoal(goal.id)}
                                    className="opacity-0 group-hover/item:opacity-100 p-1 rounded text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all flex-shrink-0"
                                    title="Remove"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}

                        {/* Empty state */}
                        {goals.length === 0 && !inputFocused && (
                            <p className="text-xs text-gray-600 text-center py-3 italic">
                                No focus items yet — add one below
                            </p>
                        )}
                    </div>

                    {/* ── Inline add input ───────────────────────────────── */}
                    <div className="pt-1 border-t border-white/[0.05]">
                        {atLimit ? (
                            <p className="text-[10px] text-gray-600 text-center py-1">
                                5 max — complete or remove an item to add more
                            </p>
                        ) : (
                            <form onSubmit={handleAddGoal}>
                                <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all ${inputFocused ? 'bg-white/[0.04] border border-amber-500/30' : 'border border-transparent hover:bg-white/[0.03]'}`}>
                                    <Plus size={13} className={`flex-shrink-0 transition-colors ${inputFocused ? 'text-amber-400' : 'text-gray-600'}`} />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onFocus={() => setInputFocused(true)}
                                        onBlur={() => { setInputFocused(false); }}
                                        onKeyDown={e => { if (e.key === 'Escape') { setInputValue(''); setInputFocused(false); e.currentTarget.blur(); } }}
                                        placeholder="+ Add focus item..."
                                        className="flex-1 bg-transparent text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:placeholder-gray-500"
                                    />
                                    {inputValue.trim() && (
                                        <button
                                            type="submit"
                                            className="text-[10px] font-bold text-amber-400 hover:text-indigo-300 flex-shrink-0 transition-colors"
                                        >
                                            Add
                                        </button>
                                    )}
                                </div>
                            </form>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default FocusWidget;
