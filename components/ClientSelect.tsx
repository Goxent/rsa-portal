import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Search, Building2, User } from 'lucide-react';
import { Client } from '../types';
import { motion, AnimatePresence } from 'framer-motion';


// Simple Popover implementation if not exists (using standard conditional rendering for now to be safe)
// Actually, let's build a self-contained component to avoid missing dependency issues

interface ClientSelectProps {
    clients: Client[];
    value: string | string[]; // ID or IDs
    onChange: (value: string | string[]) => void;
    multi?: boolean;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

const ClientSelect: React.FC<ClientSelectProps> = ({
    clients = [],
    value,
    onChange,
    multi = false,
    placeholder = "Select Client...",
    disabled = false,
    className
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [coords, setCoords] = useState<{ top: number, left: number, width: number }>({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Update position when opened or window resized/scrolled
    const updateCoords = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, []);

    useEffect(() => {
        if (open) {
            updateCoords();
            window.addEventListener('resize', updateCoords);
            window.addEventListener('scroll', updateCoords, true);
        }
        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [open, updateCoords]);

    // Ensure value is always an array for consistent handling in multi-mode
    const selectedIds = Array.isArray(value) ? value : (value ? [value] : []);

    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(search.toLowerCase()) ||
        (client.code && client.code.toLowerCase().includes(search.toLowerCase()))
    );

    const handleSelect = (clientId: string) => {
        if (multi) {
            const newIds = selectedIds.includes(clientId)
                ? selectedIds.filter(id => id !== clientId)
                : [...selectedIds, clientId];
            onChange(newIds);
        } else {
            onChange(clientId);
            setOpen(false);
        }
    };

    const getDisplayLabel = () => {
        if (selectedIds.length === 0) return <span className="text-gray-400">{placeholder}</span>;

        if (multi) {
            return (
                <div className="flex flex-wrap gap-1">
                    {selectedIds.map(id => {
                        const client = clients.find(c => c.id === id);
                        return client ? (
                            <span key={id} className="bg-brand-500/20 text-brand-200 text-xs px-2 py-0.5 rounded border border-brand-500/30 flex items-center">
                                {client.name}
                                <span className="ml-1 opacity-50 text-[10px]">({client.code})</span>
                            </span>
                        ) : null;
                    })}
                    {selectedIds.length > 2 && <span className="text-xs text-gray-400">+{selectedIds.length - 2} more</span>}
                </div>
            );
        } else {
            const client = clients.find(c => c.id === selectedIds[0]);
            return client ? (
                <span className="text-white flex items-center">
                    <span className="font-semibold mr-2">{client.name}</span>
                    <span className="text-xs text-gray-400 font-mono bg-white/10 px-1.5 rounded">{client.code}</span>
                </span>
            ) : <span className="text-gray-400">{placeholder}</span>;
        }
    };

    const dropdownContent = (
        <div 
            className="fixed z-[10000] animate-in fade-in slide-in-from-top-1 duration-150"
            style={{
                top: coords.top - window.scrollY,
                left: coords.left - window.scrollX,
                width: coords.width,
                marginTop: '6px'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="bg-[#1a1b26] border border-white/10 rounded-xl shadow-2xl overflow-hidden p-2">
                {/* Search Input */}
                <div className="flex items-center px-3 pb-2 border-b border-white/5 mb-2">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                        className="flex h-10 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-gray-500 text-white"
                        placeholder="Search clients..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* List */}
                <div className="max-h-[250px] overflow-y-auto custom-scrollbar space-y-1">
                    {filteredClients.length === 0 ? (
                        <div className="py-6 text-center text-sm text-gray-500">No client found.</div>
                    ) : (
                        filteredClients.map((client) => {
                            const isSelected = selectedIds.includes(client.id);
                            return (
                                <div
                                    key={client.id}
                                    onClick={() => handleSelect(client.id)}
                                    className={`
                                        relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none 
                                        transition-colors hover:bg-amber-600/20 data-[disabled]:pointer-events-none data-[disabled]:opacity-50
                                        ${isSelected ? 'bg-amber-600/30 text-blue-100' : 'text-gray-300'}
                                    `}
                                >
                                    <div className="flex-1">
                                        <div className="font-medium text-white flex justify-between">
                                            <span>{client.name}</span>
                                            {client.code && <span className="text-xs bg-white/10 px-1.5 rounded text-gray-400 font-mono ml-2">{client.code}</span>}
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center mt-0.5">
                                            {client.serviceType}
                                            {client.status === 'Inactive' && <span className="ml-2 text-red-400">• Inactive</span>}
                                        </div>
                                    </div>
                                    {isSelected && <Check className="ml-auto h-4 w-4 text-amber-400" />}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="pt-2 mt-2 border-t border-white/5 text-[10px] text-center text-gray-500">
                    Showing {filteredClients.length} of {clients.length} clients
                </div>
            </div>
        </div>
    );

    return (
        <div className={`relative ${className}`}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => !disabled && setOpen(!open)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 
                    transition-all text-sm text-left
                    ${disabled ? 'opacity-50 cursor-not-allowed bg-white/5' : 'cursor-pointer hover:bg-white/10 hover:border-white/20'}
                    ${open ? 'ring-2 ring-amber-500/50 border-amber-500/50' : ''}
                `}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <Building2 size={16} className="text-gray-400 flex-shrink-0" />
                    {getDisplayLabel()}
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </button>

            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[9999]"
                            onClick={() => setOpen(false)}
                        />
                        {createPortal(dropdownContent, document.body)}
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ClientSelect;
