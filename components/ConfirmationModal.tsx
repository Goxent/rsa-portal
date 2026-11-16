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
            case 'danger': return <AlertTriangle style={{ color: 'var(--color-danger)' }} size={22} />;
            case 'warning': return <AlertTriangle style={{ color: 'var(--color-warning)' }} size={22} />;
            case 'success': return <CheckCircle style={{ color: 'var(--color-success)' }} size={22} />;
            case 'indigo': return <ShieldCheck style={{ color: 'var(--accent)' }} size={22} />;
            default: return <Info style={{ color: 'var(--color-info)' }} size={22} />;
        }
    };

    const getPrimaryButtonColor = () => {
        switch (variant) {
            case 'danger': return 'bg-[var(--color-danger)] text-white hover:opacity-90';
            case 'warning': return 'bg-[var(--color-warning)] text-white hover:opacity-90';
            case 'success': return 'bg-[var(--color-success)] text-white hover:opacity-90';
            default: return 'bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90';
        }
    };

    const innerContent = (
        <div className="p-6 text-center">
            <div className="mb-4 flex justify-center">
                <div className={`p-3 rounded-full border ${
                    variant === 'danger' ? 'bg-[rgba(224,112,122,0.1)] border-[rgba(224,112,122,0.25)]' : 
                    variant === 'warning' ? 'bg-[rgba(217,164,65,0.1)] border-[rgba(217,164,65,0.25)]' :
                    variant === 'success' ? 'bg-[rgba(79,178,134,0.1)] border-[rgba(79,178,134,0.25)]' :
                    'bg-[var(--accent-dim)] border-[var(--border-accent)]'
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
                    className="px-4 py-2 rounded-lg transition-colors border text-xs font-semibold"
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
                        className="px-4 py-2 rounded-lg transition-colors border text-xs font-semibold"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-heading)' }}
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
                        className={`px-4 py-2 rounded-lg transition-colors text-xs font-semibold ${getPrimaryButtonColor()}`}
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-sm rounded-xl border shadow-xl relative animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                onClick={e => e.stopPropagation()}
            >
                {innerContent}
            </div>
        </div>
    );
};
