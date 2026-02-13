import React, { createContext, useContext, useState, ReactNode } from 'react';

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

    const openModal = (type: string, props: ModalProps = {}) => {
        setModalType(type);
        setModalProps(props);
    };

    const closeModal = () => {
        setModalType(null);
        setModalProps({});
    };

    return (
        <ModalContext.Provider value={{ isOpen: !!modalType, modalType, modalProps, openModal, closeModal }}>
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
