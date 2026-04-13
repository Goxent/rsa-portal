import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import toast from 'react-hot-toast';
import { Trophy, Target, Check, X, Plus } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { FocusGoal } from '../../../types';
import { AuthService } from '../../../services/firebase';

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

const MAX_GOALS         = 5;

// ── Main FocusWidget ──────────────────────────────────────────────────────────
const FocusWidget: React.FC = () => {
    const { user }                      = useAuth();
    const [goals, setGoals]             = useState<FocusGoal[]>([]);
    const [inputValue, setInputValue]   = useState('');
    const [inputFocused, setInputFocused] = useState(false);
    const [celebratingId, setCelebratingId] = useState<string | null>(null);
    const [isSyncing, setIsSyncing]     = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => { injectStyle(); }, []);

    // Real-time listener for Focus Goals
    useEffect(() => {
        if (!user?.uid) return;

        const userRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.currentFocusGoals) {
                    setGoals(data.currentFocusGoals);
                }
            }
        }, (error) => {
            console.error("Focus sync error:", error);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    const syncToFirestore = useCallback(async (nextGoals: FocusGoal[]) => {
        if (!user) return;
        setIsSyncing(true);
        try {
            await AuthService.updateUserProfile(user.uid, {
                currentFocusGoals: nextGoals
            });
        } catch (error) {
            console.error('Failed to sync goals:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [user]);

    const persist = useCallback((next: FocusGoal[]) => {
        setGoals(next);
        
        // Debounce sync to Firestore
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            syncToFirestore(next);
        }, 500);
    }, [syncToFirestore]);

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
                <div className={`p-1.5 rounded-lg flex-shrink-0 ${allCompleted ? 'bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400' : 'bg-brand-100 text-brand-600 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                    {allCompleted ? <Trophy size={15} /> : <Target size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-black text-slate-800 dark:text-gray-300 uppercase tracking-widest truncate">
                            Today's Focus
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                             {isSyncing && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse animate-duration-700" title="Syncing..." />}
                             <span className="text-[10px] font-bold text-slate-500 dark:text-gray-500 tabular-nums">{completedCount}/{goals.length}</span>
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

            {/* ── List & Input ── */}
            <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto custom-scrollbar">
                {goals.map(goal => (
                    <div key={goal.id} className="flex items-center gap-2.5 group/item rounded-lg px-1.5 py-1 hover:bg-brand-50 dark:hover:bg-white/[0.03] transition-colors">
                        <div
                            onClick={() => toggleGoal(goal.id)}
                            className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center cursor-pointer flex-shrink-0 transition-all duration-200 ${celebratingId === goal.id ? 'fw-pop' : ''} ${goal.completed ? 'bg-brand-500 border-brand-500' : 'border-slate-300 dark:border-slate-600 bg-transparent hover:border-brand-400 dark:hover:border-indigo-400'}`}
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
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4 animate-in fade-in duration-500">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                            <Plus size={14} className="text-slate-400" />
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-gray-600 text-center italic">
                            No focus items yet — stay sharp!
                        </p>
                    </div>
                )}
            </div>

            {/* Inline add */}
            <div className="pt-2 border-t border-slate-100 dark:border-white/[0.05]">
                {atLimit ? (
                    <div className="flex flex-col items-center gap-1.5 py-1">
                        <p className="text-[10px] text-slate-500 dark:text-gray-600 text-center">
                            Limit reached (5 goals)
                        </p>
                        <button 
                            onClick={() => persist(goals.filter(g => !g.completed))}
                            className="text-[9px] font-black uppercase tracking-wider text-brand-600 hover:text-brand-700 transition-colors"
                        >
                            Clear Completed
                        </button>
                    </div>
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
                
                {goals.length > 0 && (
                    <div className="mt-2 flex items-center justify-center gap-4 border-t border-slate-50 dark:border-white/[0.02] pt-2">
                        {completedCount > 0 && (
                            <button
                                onClick={() => persist(goals.filter(g => !g.completed))}
                                className="text-[9px] font-bold text-slate-400 hover:text-brand-500 transition-colors"
                            >
                                Clear Completed
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (window.confirm('Reset your focus list?')) persist([]);
                            }}
                            className="text-[9px] font-bold text-slate-400 hover:text-rose-500 transition-colors"
                        >
                            Reset All
                        </button>
                    </div>
                )}
            </div>

        </div>
    );
};

export default FocusWidget;
