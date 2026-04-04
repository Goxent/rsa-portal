import React from 'react';
import { AlertTriangle, Info, CheckCircle, X, ShieldCheck } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen?: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    onSecondaryConfirm?: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    secondaryLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success' | 'indigo';
    showConfirm?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
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
    const getIcon = () => {
        switch (variant) {
            case 'danger': return <AlertTriangle className="text-red-500" size={24} />;
            case 'warning': return <AlertTriangle className="text-amber-500" size={24} />;
            case 'success': return <CheckCircle className="text-green-500" size={24} />;
            case 'indigo': return <ShieldCheck className="text-brand-400" size={24} />;
            default: return <Info className="text-amber-500" size={24} />;
        }
    };

    const getPrimaryButtonColor = () => {
        switch (variant) {
            case 'danger': return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
            case 'warning': return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500';
            case 'success': return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
            case 'indigo': return 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 shadow-indigo-500/20';
            default: return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500';
        }
    };

    return (
        <div className="p-6 text-center">
            <div className="mb-4 flex justify-center">
                <div className={`p-3 rounded-full bg-white/5 border border-white/10 ${variant === 'danger' ? 'bg-red-500/10' : variant === 'indigo' ? 'bg-brand-500/10' : ''}`}>
                    {getIcon()}
                </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">{message}</p>

            <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                    onClick={onClose}
                    className="px-5 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-all border border-white/10 text-xs font-bold uppercase tracking-widest"
                >
                    {cancelLabel}
                </button>
                
                {secondaryLabel && onSecondaryConfirm && (
                    <button
                        onClick={() => {
                            onSecondaryConfirm();
                            onClose();
                        }}
                        className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl transition-all border border-white/5 text-xs font-bold uppercase tracking-widest shadow-xl"
                    >
                        {secondaryLabel}
                    </button>
                )}

                {showConfirm && onConfirm && (
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-5 py-2 text-white rounded-xl transition-all shadow-lg text-xs font-bold uppercase tracking-widest ${getPrimaryButtonColor()}`}
                    >
                        {confirmLabel}
                    </button>
                )}
            </div>
        </div>
    );
};
