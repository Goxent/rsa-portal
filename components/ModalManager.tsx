import React from 'react';
import { useModal } from '../context/ModalContext';
import { X } from 'lucide-react';

// Import Modals here
// import TaskTemplateModal from './TaskTemplateModal';

export const ModalManager: React.FC = () => {
    const { isOpen, modalType, modalProps, closeModal } = useModal();

    if (!isOpen) return null;

    const renderModalContent = () => {
        switch (modalType) {
            case 'EXAMPLE_MODAL':
                return (
                    <div className="p-6">
                        <h2 className="text-xl font-bold mb-4">{modalProps.title || 'Example Modal'}</h2>
                        <p>{modalProps.message || 'This is managed by ModalContext'}</p>
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                );
            // Add other cases here
            // case 'TASK_TEMPLATE':
            //     return <TaskTemplateModal {...modalProps} onClose={closeModal} />;

            default:
                return null;
        }
    };

    if (modalType === 'TASK_TEMPLATE') {
        // Some modals might have their own wrapper/overlay, return directly
        // return <TaskTemplateModal {...modalProps} onClose={closeModal} />
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="glass-modal rounded-xl w-full max-w-lg shadow-2xl border border-white/10 relative">
                <button
                    onClick={closeModal}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>
                {renderModalContent()}
            </div>
        </div>
    );
};
