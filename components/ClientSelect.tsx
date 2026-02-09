import React, { useState, useEffect, useRef } from 'react';
import { Search, Check, X, ChevronDown, Building2, AlertTriangle } from 'lucide-react';
import { Client } from '../types';

interface ClientSelectProps {
    clients: Client[];
    value: string | string[]; // Single ID or Array of IDs
    onChange: (value: string | string[]) => void;
    multi?: boolean;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

const ClientSelect: React.FC<ClientSelectProps> = ({
    clients = [],
    value,
    onChange,
    multi = false,
    placeholder = "Select Client...",
    className = "",
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter Logic
    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (clientId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        if (multi) {
            const currentValues = Array.isArray(value) ? value : [];
            const isAlreadySelected = currentValues.includes(clientId);
            const newValue = isAlreadySelected
                ? currentValues.filter(id => id !== clientId)
                : [...currentValues, clientId];
            onChange(newValue);
        } else {
            onChange(clientId);
            setIsOpen(false);
        }
    };

    const getInitials = (name: string, code?: string) => {
        // Use client code prefix if available (e.g., "CL-002" → "CL")
        if (code && code.includes('-')) {
            return code.split('-')[0].substring(0, 2).toUpperCase();
        }
        // Otherwise use first 2 letters of name
        return name.substring(0, 2).toUpperCase();
    };

    const renderTrigger = () => {
        const hasValue = value && (Array.isArray(value) ? value.length > 0 : true);

        if (!hasValue) {
            return <span className="text-gray-500">{placeholder}</span>;
        }

        if (multi && Array.isArray(value)) {
            const selectedItems = value.map(id => clients.find(c => c.id === id)).filter(Boolean) as Client[];

            if (selectedItems.length === 0) {
                return <span className="text-gray-500">{placeholder}</span>;
            }

            return (
                <div className="flex flex-wrap gap-1.5">
                    {selectedItems.map(client => (
                        <span key={client.id} className="bg-brand-600/30 text-brand-200 px-2 py-0.5 rounded text-[11px] flex items-center border border-brand-500/30">
                            {client.name}
                            {!disabled && (
                                <X
                                    size={10}
                                    className="ml-1.5 cursor-pointer hover:text-white"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect(client.id);
                                    }}
                                />
                            )}
                        </span>
                    ))}
                </div>
            );
        }

        const selectedId = Array.isArray(value) ? value[0] : value;
        const selectedClient = clients.find(c => c.id === selectedId);

        return selectedClient ? (
            <span className="text-gray-200 flex items-center">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-navy-700 to-navy-600 flex items-center justify-center text-[8px] font-bold mr-2 border border-white/10 shrink-0">
                    {getInitials(selectedClient.name, selectedClient.code)}
                </div>
                <span className="truncate max-w-[180px]">{selectedClient.name}</span>
            </span>
        ) : <span className="text-gray-500">{placeholder}</span>;
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div
                className={`w-full glass-input rounded-lg px-3 py-2 text-sm min-h-[42px] flex items-center justify-between cursor-pointer border border-white/10 hover:border-brand-500/50 transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isOpen ? 'ring-2 ring-brand-500/30 border-brand-500 shadow-xl' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="flex-1 overflow-hidden">
                    {renderTrigger()}
                </div>
                <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-[100] top-full left-0 right-0 mt-2 bg-navy-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 border-b border-white/10">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 placeholder-gray-500"
                                placeholder="Search clients..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto">
                        {filteredClients.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-xs">No clients found</div>
                        ) : (
                            filteredClients.map((client) => {
                                const isSelected = multi
                                    ? (Array.isArray(value) && value.includes(client.id))
                                    : value === client.id;

                                return (
                                    <div
                                        key={client.id}
                                        className={`px-3 py-2.5 hover:bg-white/5 cursor-pointer transition-colors flex items-center justify-between group ${isSelected ? 'bg-brand-500/10' : ''}`}
                                        onClick={() => handleSelect(client.id)}
                                    >
                                        <div className="flex items-center flex-1 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-700 to-navy-600 flex items-center justify-center text-[10px] font-bold mr-3 border border-white/10 shrink-0">
                                                {getInitials(client.name, client.code)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-gray-200 font-medium truncate">{client.name}</div>
                                                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                                    <span className="font-mono">{client.code}</span>
                                                    {client.status === 'Inactive' && (
                                                        <span className="text-red-400 flex items-center">
                                                            <AlertTriangle size={10} className="mr-0.5" /> Inactive
                                                        </span>
                                                    )}
                                                    {client.city && <span>• {client.city}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <Check size={16} className="text-brand-400 shrink-0 ml-2" />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {multi && Array.isArray(value) && value.length > 0 && (
                        <div className="p-2 border-t border-white/10 bg-white/5 text-xs text-gray-400 text-center">
                            {value.length} Selected
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClientSelect;
