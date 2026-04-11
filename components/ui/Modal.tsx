import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Reusable modal component with refined design tokens and animations
 */
const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    footer,
    size = 'md'
}) => {
    // Handle escape key press
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 backdrop-blur-[4px]"
                        style={{ backgroundColor: 'var(--modal-backdrop, rgba(0,0,0,0.6))' }}
                        onClick={onClose}
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.97 }}
                        transition={{ 
                            duration: 0.22, 
                            ease: [0.34, 1.56, 0.64, 1] 
                        }}
                        className={`relative w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col overflow-hidden z-10`}
                        style={{ 
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-mid)',
                            borderRadius: 'var(--radius-xl)',
                            boxShadow: 'var(--shadow-modal)'
                        }}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-title"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center transition-all duration-200 z-20 group"
                            style={{ 
                                background: 'var(--bg-surface)', 
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-muted)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'var(--bg-elevated)';
                                e.currentTarget.style.color = 'var(--text-heading)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'var(--bg-surface)';
                                e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                            aria-label="Close modal"
                        >
                            <X size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                        </button>

                        {/* Header */}
                        <div 
                            className="flex flex-col"
                            style={{ 
                                padding: '1.25rem 1.5rem',
                                borderBottom: '1px solid var(--border)'
                            }}
                        >
                            <h3 
                                id="modal-title" 
                                className="font-semibold"
                                style={{ 
                                    fontSize: '1rem',
                                    color: 'var(--text-heading)'
                                }}
                            >
                                {title}
                            </h3>
                            {subtitle && (
                                <p 
                                    className="mt-0.5"
                                    style={{ 
                                        fontSize: '0.8125rem',
                                        color: 'var(--text-muted)'
                                    }}
                                >
                                    {subtitle}
                                </p>
                            )}
                        </div>

                        {/* Content */}
                        <div 
                            className="flex-1 overflow-y-auto custom-scrollbar"
                            style={{ padding: '1.5rem' }}
                        >
                            {children}
                        </div>

                        {/* Footer (optional) */}
                        {footer && (
                            <div 
                                style={{ 
                                    padding: '1rem 1.5rem',
                                    borderTop: '1px solid var(--border)',
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: '0.5rem'
                                }}
                            >
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default Modal;
