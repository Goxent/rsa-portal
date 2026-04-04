import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Target, Trophy, X, Plus, Check, Timer, Play, Pause, RotateCcw, Coffee } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

// ── CSS ────────────────────────────────────────────────────────────────────────
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

type PomodoroMode = 'work' | 'break';

const STORAGE_KEY_GOALS = 'daily_goals';
const STORAGE_KEY_DATE  = 'daily_focus_date';
const MAX_GOALS         = 5;

const POMODORO_DURATIONS: Record<PomodoroMode, number> = {
    work:  25 * 60,
    break:  5 * 60,
};

// ── Tiny Pomodoro Timer ───────────────────────────────────────────────────────
const PomodoroTimer: React.FC = () => {
    const [mode, setMode]         = useState<PomodoroMode>('work');
    const [remaining, setRemaining] = useState(POMODORO_DURATIONS.work);
    const [running, setRunning]   = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const reset = useCallback((m: PomodoroMode = mode) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setRunning(false);
        setRemaining(POMODORO_DURATIONS[m]);
    }, [mode]);

    useEffect(() => {
        if (running) {
            intervalRef.current = setInterval(() => {
                setRemaining(r => {
                    if (r <= 1) {
                        clearInterval(intervalRef.current!);
                        setRunning(false);
                        const next = mode === 'work' ? 'break' : 'work';
                        toast(mode === 'work' ? '☕ Break time! Rest for 5 mins.' : '🎯 Back to focus!', {
                            duration: 4000,
                            style: { background: '#1e1b4b', color: '#c7d2fe', border: '1px solid rgba(99,102,241,0.3)' },
                        });
                        setMode(next);
                        setRemaining(POMODORO_DURATIONS[next]);
                        return POMODORO_DURATIONS[next];
                    }
                    return r - 1;
                });
            }, 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [running, mode]);

    const toggleMode = () => {
        const next = mode === 'work' ? 'break' : 'work';
        setMode(next);
        reset(next);
    };

    const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
    const secs = String(remaining % 60).padStart(2, '0');
    const total = POMODORO_DURATIONS[mode];
    const pct   = ((total - remaining) / total) * 100;

    const isWork   = mode === 'work';
    const trackColor = isWork ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)';
    const fillColor  = isWork
        ? 'linear-gradient(90deg, #6366f1, #818cf8)'
        : 'linear-gradient(90deg, #10b981, #34d399)';

    return (
        <div className="border-t border-white/[0.05] pt-3 mt-1">
            <div className="flex items-center gap-2 mb-2">
                <Timer size={11} className={isWork ? 'text-brand-400' : 'text-emerald-400'} />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Pomodoro — {isWork ? 'Focus 25' : 'Break 5'}
                </span>
                <button
                    onClick={toggleMode}
                    className="ml-auto text-[9px] font-bold text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
                >
                    <Coffee size={9} /> Switch
                </button>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full mb-2 overflow-hidden" style={{ background: trackColor }}>
                <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${pct}%`, background: fillColor }}
                />
            </div>

            <div className="flex items-center justify-between">
                {/* Timer display */}
                <span className={`text-xl font-black tabular-nums tracking-tight ${isWork ? 'text-brand-300' : 'text-emerald-300'}`}>
                    {mins}:{secs}
                </span>

                {/* Controls */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setRunning(r => !r)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 ${
                            isWork
                                ? 'bg-brand-500/20 text-brand-300 hover:bg-brand-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        }`}
                    >
                        {running ? <Pause size={10} /> : <Play size={10} />}
                        {running ? 'Pause' : 'Start'}
                    </button>
                    <button
                        onClick={() => reset()}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all"
                        title="Reset"
                    >
                        <RotateCcw size={11} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main FocusWidget ──────────────────────────────────────────────────────────
const FocusWidget: React.FC = () => {
    const [goals, setGoals]             = useState<Goal[]>([]);
    const [inputValue, setInputValue]   = useState('');
    const [inputFocused, setInputFocused] = useState(false);
    const [celebratingId, setCelebratingId] = useState<string | null>(null);
    const [showPomodoro, setShowPomodoro] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { injectStyle(); }, []);

    // Load from localStorage — date guard
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const savedDate = localStorage.getItem(STORAGE_KEY_DATE);
        if (savedDate === today) {
            try {
                const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY_GOALS) ?? '[]');
                if (Array.isArray(parsed)) setGoals(parsed);
            } catch { /* ignore */ }
        } else {
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
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const toggleGoal = (id: string) => {
        const next = goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g);
        const goal = next.find(g => g.id === id);
        persist(next);
        if (goal?.completed) {
            setCelebratingId(id);
            setTimeout(() => setCelebratingId(null), 400);
            const allDone = next.every(g => g.completed);
            if (allDone) toast.success('🎯 All focus goals complete!', { duration: 3000 });
            else toast('✓ Done!', { duration: 1500, style: { background: '#1e293b', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)', fontSize: '13px' } });
        }
    };

    const deleteGoal = (id: string) => persist(goals.filter(g => g.id !== id));

    const completedCount = goals.filter(g => g.completed).length;
    const allCompleted   = goals.length > 0 && completedCount === goals.length;
    const progress       = goals.length > 0 ? (completedCount / goals.length) * 100 : 0;
    const atLimit        = goals.length >= MAX_GOALS;

    return (
        <div className="relative glass-panel hover-lift rounded-2xl border border-brand-100 dark:border-white/[0.07] p-5 flex flex-col gap-3 h-full min-h-[140px]">

            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg flex-shrink-0 ${allCompleted ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-brand-100 text-brand-600 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                    {allCompleted ? <Trophy size={15} /> : <Target size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-black text-slate-800 dark:text-gray-300 uppercase tracking-widest truncate">
                            Today's Focus
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-gray-500 tabular-nums">{completedCount}/{goals.length}</span>
                            <button
                                onClick={() => setShowPomodoro(v => !v)}
                                className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${showPomodoro ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'text-slate-500 dark:text-gray-600 hover:text-brand-700 dark:hover:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                                title="Toggle Pomodoro timer"
                            >
                                <Timer size={10} /> Pomodoro
                            </button>
                        </div>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-slate-200 dark:bg-white/[0.06] overflow-hidden">
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

            {/* ── All-done state ──────────────────────────────────────── */}
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
                    {/* Goal list */}
                    <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto custom-scrollbar">
                        {goals.map(goal => (
                            <div key={goal.id} className="flex items-center gap-2.5 group/item rounded-lg px-1.5 py-1 hover:bg-brand-50 dark:hover:bg-white/[0.03] transition-colors">
                                <div
                                    onClick={() => toggleGoal(goal.id)}
                                    className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center cursor-pointer flex-shrink-0 transition-all duration-200 ${celebratingId === goal.id ? 'fw-pop' : ''} ${goal.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600 bg-transparent hover:border-brand-400 dark:hover:border-indigo-400'}`}
                                >
                                    {goal.completed && <Check size={11} className="text-white" strokeWidth={3} />}
                                </div>
                                <p
                                    onClick={() => toggleGoal(goal.id)}
                                    className={`flex-1 text-sm cursor-pointer transition-all duration-200 truncate leading-none ${goal.completed ? 'text-slate-400 dark:text-gray-500 line-through decoration-slate-300 dark:decoration-gray-600' : 'text-slate-800 dark:text-gray-200 hover:text-brand-900 dark:hover:text-white font-medium'}`}
                                    title={goal.text}
                                >
                                    {goal.text}
                                </p>
                                <button
                                    onClick={() => deleteGoal(goal.id)}
                                    className="opacity-0 group-hover/item:opacity-100 p-1 rounded text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all flex-shrink-0"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                        {goals.length === 0 && !inputFocused && (
                            <p className="text-xs text-slate-500 dark:text-gray-600 text-center py-3 italic">No focus items yet — add one below</p>
                        )}
                    </div>

                    {/* Inline add */}
                    <div className="pt-1 border-t border-slate-100 dark:border-white/[0.05]">
                        {atLimit ? (
                            <p className="text-[10px] text-slate-500 dark:text-gray-600 text-center py-1">5 max — complete or remove an item to add more</p>
                        ) : (
                            <form onSubmit={handleAddGoal}>
                                <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all ${inputFocused ? 'bg-white dark:bg-white/[0.04] border border-brand-300 dark:border-brand-500/30 shadow-sm' : 'border border-transparent hover:bg-slate-50 dark:hover:bg-white/[0.03]'}`}>
                                    <Plus size={13} className={`flex-shrink-0 transition-colors ${inputFocused ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-gray-600'}`} />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onFocus={() => setInputFocused(true)}
                                        onBlur={() => setInputFocused(false)}
                                        onKeyDown={e => { if (e.key === 'Escape') { setInputValue(''); setInputFocused(false); e.currentTarget.blur(); } }}
                                        placeholder="+ Add focus item..."
                                        className="flex-1 bg-transparent text-xs text-slate-800 dark:text-gray-300 placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:placeholder-slate-300 dark:focus:placeholder-gray-500"
                                    />
                                    {inputValue.trim() && (
                                        <button type="submit" className="text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 flex-shrink-0 transition-colors">
                                            Add
                                        </button>
                                    )}
                                </div>
                            </form>
                        )}
                    </div>
                </>
            )}

            {/* ── Pomodoro Timer (toggleable) ─────────────────────────── */}
            {showPomodoro && <PomodoroTimer />}
        </div>
    );
};

export default FocusWidget;
