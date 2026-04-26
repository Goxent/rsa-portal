/**
 * Centralized design tokens for the 'Beautiful' RSA gradient system.
 * These are used to provide consistent, colorful accents based on a seed string (e.g. Client Name).
 */

export const GRADIENT_PALETTE = [
    { from: 'from-blue-600/20 dark:from-blue-600/20', to: 'to-indigo-500/20 dark:to-indigo-400/10', accent: 'text-blue-700 dark:text-blue-400', text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-500/20 dark:bg-blue-500/10', border: 'border-blue-500/30 dark:border-blue-500/30' },
    { from: 'from-purple-600/20 dark:from-purple-600/20', to: 'to-pink-500/20 dark:to-pink-400/10', accent: 'text-purple-700 dark:text-purple-400', text: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-500/20 dark:bg-purple-500/10', border: 'border-purple-500/30 dark:border-purple-500/30' },
    { from: 'from-brand-600/20 dark:from-brand-600/20', to: 'to-teal-500/20 dark:to-teal-400/10', accent: 'text-brand-700 dark:text-brand-400', text: 'text-brand-700 dark:text-brand-400', bg: 'bg-brand-500/20 dark:bg-brand-500/10', border: 'border-brand-500/30 dark:border-brand-500/30' },
    { from: 'from-orange-600/20 dark:from-orange-600/20', to: 'to-amber-500/20 dark:to-amber-400/10', accent: 'text-orange-700 dark:text-orange-400', text: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-500/20 dark:bg-orange-500/10', border: 'border-orange-500/30 dark:border-orange-500/30' },
    { from: 'from-rose-600/20 dark:from-rose-600/20', to: 'to-red-500/20 dark:to-red-400/10', accent: 'text-rose-700 dark:text-rose-400', text: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-500/20 dark:bg-rose-500/10', border: 'border-rose-500/30 dark:border-rose-500/30' },
    { from: 'from-indigo-600/20 dark:from-indigo-600/20', to: 'to-violet-500/20 dark:to-violet-400/10', accent: 'text-indigo-700 dark:text-indigo-400', text: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-500/20 dark:bg-indigo-500/10', border: 'border-indigo-500/30 dark:border-indigo-500/30' },
    { from: 'from-cyan-600/20 dark:from-cyan-600/20', to: 'to-sky-500/20 dark:to-sky-400/10', accent: 'text-cyan-700 dark:text-cyan-400', text: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-500/20 dark:bg-cyan-500/10', border: 'border-cyan-500/30 dark:border-cyan-500/30' },
];

/**
 * Generates a consistent gradient config based on a seed string.
 */
export function getClientVisuals(seed?: string) {
    if (!seed || seed.length === 0) return GRADIENT_PALETTE[0];
        
    const index = (seed.charCodeAt(0) + seed.charCodeAt(seed.length - 1)) % GRADIENT_PALETTE.length;
    return GRADIENT_PALETTE[index];
}

/**
 * Helper to get just the gradient string
 */
export function getClientGradient(seed?: string) {
    const { from, to } = getClientVisuals(seed);
    return `${from} ${to}`;
}
