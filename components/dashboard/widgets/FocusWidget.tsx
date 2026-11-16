import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
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

// Unlimited goals allowed - removing MAX_GOALS limit

// ── Main FocusWidget ──────────────────────────────────────────────────────────
const FocusWidget: React.FC = () => {
    const { user }                      = useAuth();
    const [goals, setGoals]             = useState<FocusGoal[]>([]);
    const [inputValue, setInputValue]   = useState('');
    const [inputFocused, setInputFocused] = useState(false);
    const [celebratingId, setCelebratingId] = useState<string | null>(null);
    const [isSyncing, setIsSyncing]     = useState(false);
    const [hasLoaded, setHasLoaded]     = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => { injectStyle(); }, []);

    // L7: Auth context already has an onSnapshot listener on the user doc.
    // Read currentFocusGoals directly from the user object instead of opening a duplicate listener.
    useEffect(() => {
        if (!user) return;
        setGoals(user.currentFocusGoals ?? []);
        setHasLoaded(true);
    }, [user?.currentFocusGoals]);

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
        // Prevent accidental overwrite if Firestore data hasn't loaded yet
        if (!hasLoaded) {
            console.warn("Attempted to persist focus goals before initial load. Aborting sync to prevent data loss.");
            return;
        }

        setGoals(next);
        
        // Debounce sync to Firestore
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            syncToFirestore(next);
        }, 500);
    }, [syncToFirestore, hasLoaded]);

    const handleAddGoal = (e?: React.FormEvent) => {
        e?.preventDefault();
        const text = inputValue.trim();
        if (!text) return;
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
    const atLimit        = false; // Limit removed

    return (
        <div className="relative rounded-[var(--radius-lg)] border p-5 flex flex-col gap-3 h-full min-h-[140px] transition-colors duration-150" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>

            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-[var(--radius-sm)] flex-shrink-0" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                    {allCompleted ? <Trophy size={15} strokeWidth={1.75} /> : <Target size={15} strokeWidth={1.75} />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>
                            Today's focus
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                             {isSyncing && <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} title="Syncing..." />}
                             <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>{completedCount}/{goals.length}</span>
                        </div>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                                width: `${progress}%`,
                                background: 'var(--accent)',
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* ── List & Input ── */}
            <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto custom-scrollbar">
                {goals.map(goal => (
                    <div key={goal.id} className="flex items-center gap-2.5 group/item rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors" onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div
                            onClick={() => toggleGoal(goal.id)}
                            className={`w-[18px] h-[18px] rounded-[var(--radius-sm)] border flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors ${celebratingId === goal.id ? 'fw-pop' : ''}`}
                            style={{
                                borderColor: goal.completed ? 'var(--accent)' : 'var(--border-mid)',
                                background: goal.completed ? 'var(--accent)' : 'transparent',
                            }}
                        >
                            {goal.completed && <Check size={11} strokeWidth={2.5} style={{ color: 'var(--on-accent)' }} />}
                        </div>
                        <p
                            onClick={() => toggleGoal(goal.id)}
                            className="flex-1 text-xs cursor-pointer transition-colors truncate leading-tight"
                            style={{
                                color: goal.completed ? 'var(--text-muted)' : 'var(--text-heading)',
                                textDecoration: goal.completed ? 'line-through' : 'none',
                                fontWeight: goal.completed ? 400 : 500
                            }}
                            title={goal.text}
                        >
                            {goal.text}
                        </p>
                        <button
                            onClick={() => deleteGoal(goal.id)}
                            className="opacity-0 group-hover/item:opacity-100 p-1 rounded hover:text-[var(--color-danger)] transition-opacity flex-shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                            aria-label="Delete focus goal"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
                
                {goals.length === 0 && !inputFocused && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4">
                        <Target size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                            No focus items yet. Add a priority for today.
                        </p>
                    </div>
                )}
            </div>

            {/* Inline add */}
            <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                {atLimit ? (
                    <div className="flex flex-col items-center gap-1.5 py-1">
                        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                            Limit reached
                        </p>
                        <button 
                            onClick={() => persist(goals.filter(g => !g.completed))}
                            className="text-xs font-semibold hover:underline transition-colors"
                            style={{ color: 'var(--accent)' }}
                        >
                            Clear completed
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleAddGoal}>
                        <div className="flex items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-1.5 transition-colors border" style={{ borderColor: inputFocused ? 'var(--accent)' : 'var(--border)', background: 'var(--bg-main)' }}>
                            <Plus size={13} strokeWidth={1.75} style={{ color: inputFocused ? 'var(--accent)' : 'var(--text-muted)' }} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onFocus={() => setInputFocused(true)}
                                onBlur={() => setInputFocused(false)}
                                onKeyDown={e => { if (e.key === 'Escape') { setInputValue(''); setInputFocused(false); e.currentTarget.blur(); } }}
                                placeholder="Add focus item..."
                                className="flex-1 bg-transparent text-xs outline-none"
                                style={{ color: 'var(--text-heading)' }}
                            />
                            {inputValue.trim() && (
                                <button type="submit" className="text-xs font-semibold flex-shrink-0 transition-colors" style={{ color: 'var(--accent)' }}>
                                    Add
                                </button>
                            )}
                        </div>
                    </form>
                )}
                
                {goals.length > 0 && (
                    <div className="mt-2 flex items-center justify-center gap-4 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                        {completedCount > 0 && (
                            <button
                                onClick={() => persist(goals.filter(g => !g.completed))}
                                className="text-[11px] font-medium transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                                Clear completed
                            </button>
                        )}
                        <button
                            onClick={() => persist([])}
                            className="text-[11px] font-medium transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                            Reset all
                        </button>
                    </div>
                )}
            </div>

        </div>
    );
};

export default FocusWidget;
