import React, { useState, useEffect, useRef } from 'react';
import { Search, Check, X, ChevronDown, Building2, AlertTriangle, Briefcase, FileText } from 'lucide-react';
import { Client } from '../types';

interface ClientSelectProps {
    clients: Client[];
    value: string | string[]; // Single ID or Array of IDs
    onChange: (value: string | string[]) => void;
    multi?: boolean;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    error?: boolean;
}

const ClientSelect: React.FC<ClientSelectProps> = ({
    clients = [],
    value,
    onChange,
    multi = false,
    placeholder = "Select Client...",
    className = "",
    disabled = false,
    error = false
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

    // Selection Logic
    const handleSelect = (clientId: string) => {
        if (multi) {
            const currentValues = Array.isArray(value) ? value : [];
            if (currentValues.includes(clientId)) {
                onChange(currentValues.filter(id => id !== clientId));
            } else {
                onChange([...currentValues, clientId]);
            }
        } else {
            onChange(clientId);
            setIsOpen(false);
        }
    };

    // Filter Logic
    const filteredClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Selected Item Display
    const getDisplayValue = () => {
        if (!value || (Array.isArray(value) && value.length === 0)) return null;

        if (multi) {
            const selectedCount = (value as string[]).length;
            if (selectedCount === 1) {
                const client = clients.find(c => c.id === (value as string[])[0]);
                return client?.name;
            }
            return `${selectedCount} Clients Selected`;
        } else {
            const client = clients.find(c => c.id === value);
            return client?.name;
        }
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Trigger Button */}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all cursor-pointer
                    ${disabled ? 'bg-white/5 opacity-50 cursor-not-allowed border-white/5' : 'bg-black/20 hover:bg-black/30 hover:border-white/20'}
                    ${error ? 'border-red-500/50' : 'border-white/10'}
                    ${isOpen ? 'ring-2 ring-brand-500/50 border-brand-500/50' : ''}
                `}
            >
                <div className="flex items-center truncate mr-2">
                    <Building2 size={16} className={`mr-2 shrink-0 ${value && (Array.isArray(value) ? value.length > 0 : value) ? 'text-brand-400' : 'text-gray-500'}`} />
                    <span className={`text-sm truncate ${value && (Array.isArray(value) ? value.length > 0 : value) ? 'text-white font-medium' : 'text-gray-500'}`}>
                        {getDisplayValue() || placeholder}
                    </span>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-navy-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[300px]">
                    {/* Search Bar */}
                    <div className="p-2 border-b border-white/5 bg-white/5">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                autoFocus
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 placeholder-gray-600"
                                placeholder="Search clients..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                        {filteredClients.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-xs">No clients found</div>
                        ) : (
                            filteredClients.map(client => {
                                const isSelected = multi
                                    ? (value as string[]).includes(client.id)
                                    : value === client.id;

                                return (
                                    <div
                                        key={client.id}
                                        onClick={() => handleSelect(client.id)}
                                        className={`
                                            flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer mb-0.5 text-sm group transition-colors
                                            ${isSelected ? 'bg-brand-500/20 text-brand-100' : 'text-gray-300 hover:bg-white/5 hover:text-white'}
                                        `}
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium truncate">{client.name}</span>
                                            <div className="flex items-center text-[10px] opacity-70 mt-0.5 space-x-2">
                                                <span className="font-mono">{client.code}</span>
                                                {client.riskProfile === 'HIGH' && (
                                                    <span className="text-red-400 flex items-center font-bold"><AlertTriangle size={10} className="mr-0.5" /> High Risk</span>
                                                )}
                                            </div>
                                        </div>
                                        {isSelected && <Check size={16} className="text-brand-400 shrink-0 ml-2" />}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer for multi-select */}
                    {multi && (
                        <div className="p-2 border-t border-white/5 bg-white/5 text-[10px] text-center text-gray-500">
                            {(value as string[]).length} Selected
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClientSelect;
