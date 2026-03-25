import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, ChevronDown } from 'lucide-react';
import { Client } from '../types';
import EmptyState from './common/EmptyState';

interface SearchableClientSelectProps {
    clients: Client[];
    value: string;
    onChange: (val: string) => void;
    disabled: boolean;
    placeholder?: string;
}

const SearchableClientSelect: React.FC<SearchableClientSelectProps> = ({
    clients,
    value,
    onChange,
    disabled,
    placeholder = "Select Client"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [coords, setCoords] = useState<{ top: number, left: number, width: number }>({ top: 0, left: 0, width: 0 });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedClient = clients.find(c => c.id === value);

    // Update position when opened or window resized/scrolled
    const updateCoords = useCallback(() => {
        if (wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            updateCoords();
            window.addEventListener('resize', updateCoords);
            // capture: true to handle scrolls in parent containers
            window.addEventListener('scroll', updateCoords, true);
        }
        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [isOpen, updateCoords]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            // Check if click is inside toggle button or inside the portal content
            if (wrapperRef.current && wrapperRef.current.contains(target)) return;
            if (target.closest('[data-portal-content="client-select"]')) return;

            setIsOpen(false);
            setSearchTerm('');
        };
        
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Auto-focus search when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            const timer = setTimeout(() => inputRef.current?.focus(), 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const dropdownContent = (
        <div 
            data-portal-content="client-select"
            className="absolute z-[100000] animate-in fade-in slide-in-from-top-1 duration-150"
            style={{
                top: coords.top,
                left: coords.left,
                width: coords.width,
                marginTop: '6px'
            }}
        >
            <div className="bg-[#0d1526] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Search Bar */}
                <div className="p-2.5 border-b border-white/5">
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-[11px] text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/50 focus:bg-brand-500/5 transition-all"
                            placeholder="Search clients..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={11} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Client List */}
                <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
                    {filteredClients.length > 0 ? (
                        filteredClients.map(client => {
                            const isSelected = value === client.id;
                            return (
                                <button
                                    key={client.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(client.id);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className={`
                                        w-full text-left px-3 py-2.5 text-[11px] mx-1 rounded-lg
                                        transition-all duration-100 flex items-center justify-between gap-2
                                        ${isSelected
                                            ? 'bg-brand-600/25 text-brand-200'
                                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                        }
                                    `}
                                    style={{ width: 'calc(100% - 8px)' }}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSelected ? 'bg-brand-400' : 'bg-gray-600'}`} />
                                        <span className="truncate">{client.name}</span>
                                    </div>
                                    {isSelected && (
                                        <Check size={12} className="text-brand-400 flex-shrink-0" />
                                    )}
                                </button>
                            );
                        })
                    ) : (
                        <div className="p-4 text-center">
                            <Search size={24} className="mx-auto text-gray-600 mb-2" />
                            <p className="text-[10px] text-gray-500">No clients found</p>
                        </div>
                    )}
                </div>

                {/* Footer count */}
                {filteredClients.length > 0 && (
                    <div className="px-3 py-1.5 border-t border-white/5 text-[10px] text-gray-600">
                        {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
                        {searchTerm ? ` matching "${searchTerm}"` : ' available'}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={`relative w-full ${isOpen ? 'z-[100]' : ''}`} ref={wrapperRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(prev => !prev)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between
                    bg-black/30 border rounded-xl px-4 py-2.5
                    text-[12px] text-left transition-all duration-200
                    ${isOpen
                        ? 'border-brand-500/60 bg-brand-500/5 shadow-[0_0_0_3px_rgba(99,102,241,0.1)]'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                    }
                    ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedClient ? 'bg-brand-400' : 'bg-gray-600'}`} />
                    <span className={`truncate font-medium ${selectedClient ? 'text-white' : 'text-gray-500'}`}>
                        {selectedClient ? selectedClient.name : placeholder}
                    </span>
                </div>
                <ChevronDown
                    size={14}
                    className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-400' : ''}`}
                />
            </button>

            {/* Dropdown Panel — Portaled to body */}
            {isOpen && createPortal(dropdownContent, document.body)}
        </div>
    );
};

export default SearchableClientSelect;
