/**
 * Centralized design tokens for the 'Beautiful' RSA gradient system.
 * These are used to provide consistent, colorful accents based on a seed string (e.g. Client Name).
 */

export const GRADIENT_PALETTE = [
    { from: 'from-blue-600/20', to: 'to-indigo-400/10', accent: 'text-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30 shadow-blue-500/10' },
    { from: 'from-purple-600/20', to: 'to-pink-400/10', accent: 'text-purple-400', text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30 shadow-purple-500/10' },
    { from: 'from-emerald-600/20', to: 'to-teal-400/10', accent: 'text-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30 shadow-emerald-500/10' },
    { from: 'from-orange-600/20', to: 'to-amber-400/10', accent: 'text-orange-400', text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30 shadow-orange-500/10' },
    { from: 'from-rose-600/20', to: 'to-red-400/10', accent: 'text-rose-400', text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30 shadow-rose-500/10' },
    { from: 'from-indigo-600/20', to: 'to-violet-400/10', accent: 'text-indigo-400', text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30 shadow-indigo-500/10' },
    { from: 'from-cyan-600/20', to: 'to-sky-400/10', accent: 'text-cyan-400', text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30 shadow-cyan-500/10' },
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
