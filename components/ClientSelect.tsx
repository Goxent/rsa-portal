import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Search, Building2 } from 'lucide-react';
import { Client } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

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
    placeholder = "Select client...",
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
        if (selectedIds.length === 0) return <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>;

        if (multi) {
            return (
                <div className="flex flex-wrap gap-1">
                    {selectedIds.map(id => {
                        const client = clients.find(c => c.id === id);
                        return client ? (
                            <span 
                                key={id} 
                                className="text-xs px-2 py-0.5 rounded border flex items-center"
                                style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--border-accent)' }}
                            >
                                {client.name}
                                <span className="ml-1 opacity-70 text-[10px] font-mono">({client.code})</span>
                            </span>
                        ) : null;
                    })}
                    {selectedIds.length > 2 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>+{selectedIds.length - 2} more</span>}
                </div>
            );
        } else {
            const client = clients.find(c => c.id === selectedIds[0]);
            return client ? (
                <span className="flex items-center" style={{ color: 'var(--text-heading)' }}>
                    <span className="font-medium mr-2">{client.name}</span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded border" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>{client.code}</span>
                </span>
            ) : <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>;
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
            <div 
                className="border rounded-xl shadow-xl overflow-hidden p-2"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            >
                {/* Search Input */}
                <div className="flex items-center px-3 pb-2 border-b mb-2" style={{ borderColor: 'var(--border)' }}>
                    <Search className="mr-2 h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <input
                        className="flex h-9 w-full rounded-md bg-transparent text-sm outline-none"
                        style={{ color: 'var(--text-heading)' }}
                        placeholder="Search clients..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* List */}
                <div className="max-h-[250px] overflow-y-auto custom-scrollbar space-y-1">
                    {filteredClients.length === 0 ? (
                        <div className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No clients found.</div>
                    ) : (
                        filteredClients.map((client) => {
                            const isSelected = selectedIds.includes(client.id);
                            return (
                                <div
                                    key={client.id}
                                    onClick={() => handleSelect(client.id)}
                                    className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                                    style={{
                                        background: isSelected ? 'var(--accent-dim)' : 'transparent',
                                        color: isSelected ? 'var(--accent)' : 'var(--text-body)'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    <div className="flex-1">
                                        <div className="font-medium flex justify-between items-center" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-heading)' }}>
                                            <span>{client.name}</span>
                                            {client.code && (
                                                <span className="text-xs px-1.5 py-0.2 rounded border font-mono ml-2" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                                                    {client.code}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs flex items-center mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                            {client.serviceType}
                                            {client.status === 'Inactive' && <span className="ml-2" style={{ color: 'var(--color-danger)' }}>• Inactive</span>}
                                        </div>
                                    </div>
                                    {isSelected && <Check className="ml-auto h-4 w-4" style={{ color: 'var(--accent)' }} />}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="pt-2 mt-2 border-t text-[11px] text-center" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    Showing {filteredClients.length} of {clients.length} clients
                </div>
            </div>
        </div>
    );

    return (
        <div className={`relative ${className || ''}`}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => !disabled && setOpen(!open)}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors text-sm text-left ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                style={{
                    background: 'var(--bg-elevated)',
                    borderColor: open ? 'var(--accent)' : 'var(--border)',
                    boxShadow: open ? '0 0 0 1px var(--accent)' : 'none'
                }}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <Building2 size={16} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                    {getDisplayLabel()}
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
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
