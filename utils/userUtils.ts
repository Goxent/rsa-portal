/**
 * Generates a consistent, aesthetically pleasing color/gradient based on a UID hash.
 * This ensures the same user always has the same brand color across the app.
 */
export const getAvatarColor = (uid: string = 'guest') => {
  const hash = uid.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  // Premium color palettes (Gradients)
  const gradients = [
    { from: 'from-blue-600/20', to: 'to-indigo-400/10', text: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/10' },
    { from: 'from-purple-600/20', to: 'to-pink-400/10', text: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/10' },
    { from: 'from-brand-600/20', to: 'to-teal-400/10', text: 'text-brand-400', border: 'border-brand-500/20', bg: 'bg-brand-500/10' },
    { from: 'from-orange-600/20', to: 'to-amber-400/10', text: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/10' },
    { from: 'from-rose-600/20', to: 'to-red-400/10', text: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/10' },
    { from: 'from-indigo-600/20', to: 'to-violet-400/10', text: 'text-indigo-400', border: 'border-indigo-500/20', bg: 'bg-indigo-500/10' },
    { from: 'from-cyan-600/20', to: 'to-sky-400/10', text: 'text-cyan-400', border: 'border-cyan-500/20', bg: 'bg-cyan-500/10' },
    { from: 'from-amber-600/20', to: 'to-yellow-400/10', text: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/10' },
  ];

  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

/**
 * Gets initials from a display name.
 */
export const getInitials = (name: string) => {
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || '?';
};
