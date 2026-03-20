import React from 'react';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen?: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'danger'
}) => {
    const getIcon = () => {
        switch (variant) {
            case 'danger': return <AlertTriangle className="text-red-500" size={24} />;
            case 'warning': return <AlertTriangle className="text-amber-500" size={24} />;
            case 'success': return <CheckCircle className="text-green-500" size={24} />;
            default: return <Info className="text-amber-500" size={24} />;
        }
    };

    const getButtonColor = () => {
        switch (variant) {
            case 'danger': return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
            case 'warning': return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500';
            case 'success': return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
            default: return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500';
        }
    };

    return (
        <div className="p-6 text-center">
            <div className="mb-4 flex justify-center">
                <div className={`p-3 rounded-full bg-white/5 border border-white/10 ${variant === 'danger' ? 'bg-red-500/10' : ''}`}>
                    {getIcon()}
                </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-gray-400 mb-6">{message}</p>

            <div className="flex justify-center gap-3">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors border border-white/10"
                >
                    {cancelLabel}
                </button>
                <button
                    onClick={() => {
                        onConfirm();
                        onClose();
                    }}
                    className={`px-4 py-2 text-white rounded-lg transition-all shadow-lg ${getButtonColor()}`}
                >
                    {confirmLabel}
                </button>
            </div>
        </div>
    );
};
