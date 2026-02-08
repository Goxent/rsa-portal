
import React, { useState, useEffect, useRef } from 'react';
import { Search, Check, X, ChevronDown, Building2, AlertTriangle, Briefcase } from 'lucide-react';
import { Client } from '../types';
import { AuthService } from '../services/firebase';

interface ClientSelectProps {
    value: string | string[]; // Single ID or Array of IDs
    onChange: (value: string | string[]) => void;
    multi?: boolean;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

const ClientSelect: React.FC<ClientSelectProps> = ({
    value,
    onChange,
    multi = false,
    placeholder = "Select Client...",
    className = "",
    disabled = false
}) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch clients on mount
    useEffect(() => {
        const loadClients = async () => {
            const data = await AuthService.getAllClients();
            // Filter out Inactive clients unless they are already selected
            // But for soft-delete logic, we generally only want Active ones in new selections
            // We'll keep it simple: Show all Active, plus any Inactive that are currently selected (to preserve history)
            setClients(data.filter(c => c.status === 'Active' || (Array.isArray(value) ? value.includes(c.id) : value === c.id)));
        };
        loadClients();
    }, []);

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

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase())
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
            // Don't close on multi-select
        } else {
            onChange(clientId);
            setIsOpen(false);
        }
    };

    const getRiskColor = (risk?: string) => {
        switch (risk) {
            case 'HIGH': return 'text-red-400';
            case 'MEDIUM': return 'text-orange-400';
            case 'LOW': return 'text-emerald-400';
            default: return 'text-gray-400';
        }
    };

    // Render Logic
    const renderTriggerObject = () => {
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
                <div className="flex flex-wrap gap-2">
                    {selectedItems.map(c => (
                        <span key={c.id} className="bg-brand-600/30 text-brand-200 px-2 py-0.5 rounded text-xs flex items-center border border-brand-500/30">
                            {c.name}
                            {!disabled && (
                                <X
                                    size={12}
                                    className="ml-1 cursor-pointer hover:text-white"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect(c.id);
                                    }}
                                />
                            )}
                        </span>
                    ))}
                </div>
            );
        }

        const selectedClient = clients.find(c => c.id === (Array.isArray(value) ? value[0] : value));
        return selectedClient ? (
            <span className="text-gray-200 flex items-center">
                <Building2 size={14} className="mr-2 text-brand-400" />
                <span className="truncate max-w-[200px]">{selectedClient.name}</span>
                <span className="ml-2 text-[10px] text-gray-500 hidden sm:inline">({selectedClient.code})</span>
            </span>
        ) : <span className="text-gray-500">{placeholder}</span>;
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div
                className={`w-full glass-input rounded-lg px-3 py-2 text-sm min-h-[42px] flex items-center justify-between cursor-pointer border border-white/10 hover:border-brand-500/50 transition-colors ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${isOpen ? 'ring-2 ring-brand-500/50 border-brand-500' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="flex-1">
                    {renderTriggerObject()}
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-navy-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 border-b border-white/10 sticky top-0 bg-navy-900/95 z-10">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search clients..."
                                className="w-full bg-black/20 text-white text-xs rounded-lg pl-9 pr-3 py-2 border border-white/5 focus:border-brand-500/50 focus:outline-none"
                                value={searchTerm}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                        {filteredClients.length > 0 ? (
                            filteredClients.map(client => {
                                const isSelected = Array.isArray(value) ? value.includes(client.id) : value === client.id;
                                return (
                                    <div
                                        key={client.id}
                                        className={`px-3 py-2.5 rounded-lg text-sm cursor-pointer flex items-center justify-between group transition-colors ${isSelected ? 'bg-brand-600/20 text-brand-200' : 'text-gray-300 hover:bg-white/5'}`}
                                        onClick={(e) => handleSelect(client.id, e)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium flex items-center">
                                                {client.name}
                                                {client.riskProfile === 'HIGH' && <AlertTriangle size={12} className="ml-2 text-red-500" />}
                                            </span>
                                            <div className="flex items-center text-[10px] text-gray-500 mt-0.5 space-x-2">
                                                <span>{client.code}</span>
                                                <span>•</span>
                                                <span>{client.serviceType}</span>
                                            </div>
                                        </div>
                                        {isSelected && <Check size={14} className="text-brand-400" />}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-4 text-center text-gray-500 text-xs">No clients found</div>
                        )}
                    </div>
                    <div className="p-2 bg-navy-950/50 border-t border-white/5 text-[10px] text-center text-gray-500">
                        Showing {filteredClients.length} clients
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientSelect;
