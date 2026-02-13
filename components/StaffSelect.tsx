
import React, { useState, useEffect, useRef } from 'react';
import { Search, Check, X, ChevronDown, User } from 'lucide-react';
import { UserProfile } from '../types';
import { AuthService } from '../services/firebase';

interface StaffSelectProps {
    users?: UserProfile[]; // Optional, will fetch if not provided
    value: string | string[]; // Single ID or Array of IDs
    onChange: (value: string | string[]) => void;
    multi?: boolean;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    showAllOption?: boolean;
}

const StaffSelect: React.FC<StaffSelectProps> = ({
    users: initialUsers,
    value,
    onChange,
    multi = false,
    placeholder = "Select Staff...",
    className = "",
    disabled = false,
    showAllOption = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<UserProfile[]>(initialUsers || []);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!initialUsers) {
            AuthService.getAllUsers().then(setUsers);
        } else {
            setUsers(initialUsers);
        }
    }, [initialUsers]);

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

    const filteredUsers = users.filter(u =>
        (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const allOptions = showAllOption
        ? [{ uid: 'ALL', displayName: 'All Staff Members', email: '', role: 'SYSTEM' as any, department: 'ALL' } as UserProfile, ...filteredUsers]
        : filteredUsers;

    const handleSelect = (userId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        if (multi) {
            const currentValues = Array.isArray(value) ? value : [];
            const isAlreadySelected = currentValues.includes(userId);
            const newValue = isAlreadySelected
                ? currentValues.filter(id => id !== userId)
                : [...currentValues, userId];
            onChange(newValue);
        } else {
            onChange(userId);
            setIsOpen(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
            : '?';
    };

    const renderTrigger = () => {
        const hasValue = value && (Array.isArray(value) ? value.length > 0 : true);

        if (!hasValue) {
            return <span className="text-gray-500">{placeholder}</span>;
        }

        if (multi && Array.isArray(value)) {
            const selectedItems = value.map(id => users.find(u => u.uid === id)).filter(Boolean) as UserProfile[];

            if (selectedItems.length === 0) {
                return <span className="text-gray-500">{placeholder}</span>;
            }

            return (
                <div className="flex flex-wrap gap-1.5">
                    {selectedItems.map(u => (
                        <span key={u.uid} className="bg-brand-600/30 text-brand-200 px-2 py-0.5 rounded text-[11px] flex items-center border border-brand-500/30">
                            {u.displayName}
                            {!disabled && (
                                <X
                                    size={10}
                                    className="ml-1.5 cursor-pointer hover:text-white"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect(u.uid);
                                    }}
                                />
                            )}
                        </span>
                    ))}
                </div>
            );
        }

        const selectedId = Array.isArray(value) ? value[0] : value;
        const selectedUser = users.find(u => u.uid === selectedId) || (showAllOption && selectedId === 'ALL' ? { displayName: 'All Staff Members' } : null);

        return selectedUser ? (
            <span className="text-gray-200 flex items-center">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-navy-700 to-navy-600 flex items-center justify-center text-[8px] font-bold mr-2 border border-white/10 shrink-0">
                    {getInitials(selectedUser.displayName)}
                </div>
                <span className="truncate max-w-[180px]">{selectedUser.displayName}</span>
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
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search staff..."
                                className="w-full bg-black/40 text-white text-xs rounded-lg pl-9 pr-3 py-2 border border-white/5 focus:border-brand-500/50 focus:outline-none"
                                value={searchTerm}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                        {allOptions.length > 0 ? (
                            allOptions.map(user => {
                                const isSelected = Array.isArray(value) ? value.includes(user.uid) : value === user.uid;
                                return (
                                    <div
                                        key={user.uid}
                                        className={`px-3 py-2 rounded-lg text-sm cursor-pointer flex items-center justify-between group transition-colors mb-0.5 ${isSelected ? 'bg-brand-600/20 text-brand-200' : 'text-gray-300 hover:bg-white/5'}`}
                                        onClick={(e) => handleSelect(user.uid, e)}
                                    >
                                        <div className="flex items-center">
                                            {user.uid === 'ALL' ? (
                                                <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-[10px] font-bold mr-3 border border-brand-500/20 text-brand-400">
                                                    ALL
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-navy-800 flex items-center justify-center text-[10px] font-bold mr-3 border border-white/5 group-hover:border-white/10">
                                                    {getInitials(user.displayName)}
                                                </div>
                                            )}
                                            <div className="flex flex-col">
                                                <span className="font-medium text-white">{user.displayName}</span>
                                                {user.uid !== 'ALL' && (
                                                    <div className="flex items-center text-[10px] text-gray-500 space-x-2">
                                                        <span>{user.position || user.role}</span>
                                                        <span>•</span>
                                                        <span>{user.department}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {isSelected && <Check size={14} className="text-brand-400" />}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-4 text-center text-gray-500 text-xs">No staff found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffSelect;
