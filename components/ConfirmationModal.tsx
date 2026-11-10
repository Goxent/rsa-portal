import React from 'react';
import { AlertTriangle, Info, CheckCircle, ShieldCheck } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen?: boolean;
    isEmbedded?: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    onSecondaryConfirm?: () => void;
    title: string;
    message: string | React.ReactNode;
    confirmLabel?: string;
    secondaryLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success' | 'indigo';
    showConfirm?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    isEmbedded = false,
    onClose,
    onConfirm,
    onSecondaryConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    secondaryLabel,
    cancelLabel = 'Cancel',
    variant = 'danger',
    showConfirm = true
}) => {
    // If isOpen is explicitly passed and false, do not render anything
    if (isOpen === false) {
        return null;
    }

    const getIcon = () => {
        switch (variant) {
            case 'danger': return <AlertTriangle className="text-red-500" size={22} />;
            case 'warning': return <AlertTriangle className="text-amber-500" size={22} />;
            case 'success': return <CheckCircle className="text-emerald-500" size={22} />;
            case 'indigo': return <ShieldCheck className="text-indigo-400" size={22} />;
            default: return <Info className="text-amber-500" size={22} />;
        }
    };

    const getPrimaryButtonColor = () => {
        switch (variant) {
            case 'danger': return 'bg-red-600 hover:bg-red-700 text-white';
            case 'warning': return 'bg-amber-600 hover:bg-amber-700 text-white';
            case 'success': return 'bg-emerald-600 hover:bg-emerald-700 text-white';
            case 'indigo': return 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20';
            default: return 'bg-amber-600 hover:bg-amber-700 text-white';
        }
    };

    const innerContent = (
        <div className="p-6 text-center">
            <div className="mb-4 flex justify-center">
                <div className={`p-3 rounded-full border ${
                    variant === 'danger' ? 'bg-red-500/10 border-red-500/20' : 
                    variant === 'warning' ? 'bg-amber-500/10 border-amber-500/20' :
                    variant === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' :
                    'bg-sky-500/10 border-sky-500/20'
                }`}>
                    {getIcon()}
                </div>
            </div>

            {title && (
                <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-heading)' }}>
                    {title}
                </h3>
            )}
            
            {message && (
                <div className="mb-6 text-xs leading-relaxed text-center" style={{ color: 'var(--text-muted)' }}>
                    {message}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg transition-all border text-xs font-bold uppercase tracking-wider"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-heading)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                    {cancelLabel}
                </button>
                
                {secondaryLabel && onSecondaryConfirm && (
                    <button
                        type="button"
                        onClick={() => {
                            onSecondaryConfirm();
                            onClose();
                        }}
                        className="px-4 py-2 rounded-lg transition-all border text-xs font-bold uppercase tracking-wider shadow-sm"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-mid)', color: 'var(--text-heading)' }}
                    >
                        {secondaryLabel}
                    </button>
                )}

                {showConfirm && onConfirm && (
                    <button
                        type="button"
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-4 py-2 rounded-lg transition-all shadow-sm text-xs font-bold uppercase tracking-wider ${getPrimaryButtonColor()}`}
                    >
                        {confirmLabel}
                    </button>
                )}
            </div>
        </div>
    );

    // If embedded inside ModalManager or TasksPage modal, return the inner content
    if (isEmbedded || isOpen === undefined) {
        return innerContent;
    }

    // Direct standalone usage with isOpen prop -> render full modal overlay with backdrop
    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-sm rounded-xl border shadow-2xl relative animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-mid)' }}
                onClick={e => e.stopPropagation()}
            >
                {innerContent}
            </div>
        </div>
    );
};
