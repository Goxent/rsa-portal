import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';

type ModalType = string | null;
type ModalProps = Record<string, any>;

interface ModalContextType {
    isOpen: boolean;
    modalType: ModalType;
    modalProps: ModalProps;
    openModal: (type: string, props?: ModalProps) => void;
    closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [modalType, setModalType] = useState<ModalType>(null);
    const [modalProps, setModalProps] = useState<ModalProps>({});

    const openModal = useCallback((type: string, props: ModalProps = {}) => {
        setModalType(type);
        setModalProps(props);
    }, []);

    const closeModal = useCallback(() => {
        setModalType(null);
        setModalProps({});
    }, []);

    const contextValue = useMemo(() => ({
        isOpen: !!modalType,
        modalType,
        modalProps,
        openModal,
        closeModal,
    }), [modalType, modalProps, openModal, closeModal]);

    return (
        <ModalContext.Provider value={contextValue}>
            {children}
        </ModalContext.Provider>
    );
};

export const useModal = () => {
    const context = useContext(ModalContext);
    if (context === undefined) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
};
