import React, { useState } from 'react';
import { Search, X, Users, Building2, ShieldAlert } from 'lucide-react';
import { useUsers } from '../../hooks/useStaff';
import { UserRole } from '../../types';

interface RecipientSelectorProps {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}

export const RecipientSelector: React.FC<RecipientSelectorProps> = ({ selectedIds, onChange }) => {
    const { data: rawUsers = [], isLoading } = useUsers();
    
    // Specifically exclude Master Admins from all recipient selections
    const users = rawUsers.filter(u => u.role !== UserRole.MASTER_ADMIN);

    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const isAllSelected = selectedIds.length === 1 && selectedIds[0] === 'ALL';

    const handleToggleAll = () => {
        if (isAllSelected) {
            onChange([]);
        } else {
            onChange(['ALL']);
        }
    };

    const handleDepartmentSelect = (dept: string) => {
        const deptUsers = users.filter(u => u.department === dept).map(u => u.uid);
        if (isAllSelected) {
            onChange([...new Set([...deptUsers])]);
        } else {
            onChange([...new Set([...selectedIds, ...deptUsers])]);
        }
    };

    const handleRoleSelect = (role: UserRole) => {
        const roleUsers = users.filter(u => u.role === role).map(u => u.uid);
        if (isAllSelected) {
            onChange([...new Set([...roleUsers])]);
        } else {
            onChange([...new Set([...selectedIds, ...roleUsers])]);
        }
    };

    const toggleUser = (uid: string) => {
        if (isAllSelected) {
            onChange([uid]);
            return;
        }
        if (selectedIds.includes(uid)) {
            onChange(selectedIds.filter(id => id !== uid));
        } else {
            onChange([...selectedIds, uid]);
        }
    };

    const removeUser = (uid: string) => {
        if (isAllSelected) {
             onChange([]);
        } else {
             onChange(selectedIds.filter(id => id !== uid));
        }
    };

    const filteredUsers = users.filter(u => 
        u.displayName?.toLowerCase().includes(search.toLowerCase()) || 
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    const departments = [...new Set(users.map(u => u.department).filter(Boolean))];

    return (
        <div className="relative">
            <div className="flex flex-wrap gap-2 mb-2 p-2 min-h-[42px] border rounded-[var(--radius-md)] focus-within:ring-2 ring-[var(--accent)] transition-all bg-[var(--bg-surface)] border-[var(--border-mid)]"
                 onClick={() => setIsOpen(true)}>
                
                {isAllSelected && (
                    <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[var(--accent)] text-white">
                        <Users size={12} /> All Staff
                        <button onClick={(e) => { e.stopPropagation(); handleToggleAll(); }} className="ml-1 hover:text-red-200">
                            <X size={12} />
                        </button>
                    </span>
                )}

                {!isAllSelected && selectedIds.map(id => {
                    const user = users.find(u => u.uid === id);
                    if (!user) return null;
                    return (
                        <span key={id} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-[var(--bg-elevated)] border border-[var(--border-mid)] text-[var(--text-heading)] shadow-sm">
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)] flex items-center justify-center text-[8px] text-white">
                                {user.displayName?.charAt(0).toUpperCase()}
                            </div>
                            {user.displayName}
                            <button onClick={(e) => { e.stopPropagation(); removeUser(id); }} className="ml-0.5 text-[var(--text-muted)] hover:text-red-500">
                                <X size={12} />
                            </button>
                        </span>
                    );
                })}

                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    placeholder={selectedIds.length === 0 ? "Search to tag recipients..." : ""}
                    className="flex-1 min-w-[150px] bg-transparent outline-none text-sm text-[var(--text-body)] placeholder:text-[var(--text-muted)]"
                />
            </div>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute z-50 w-full mt-1 bg-[var(--bg-elevated)] border border-[var(--border-mid)] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden max-h-[350px] flex flex-col">
                        
                        <div className="p-3 border-b border-[var(--border-mid)] bg-[var(--bg-surface)]">
                            <button 
                                onClick={handleToggleAll}
                                className={`w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-[var(--radius-md)] transition-colors ${isAllSelected ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-elevated)] border border-[var(--border-mid)] text-[var(--text-heading)] hover:border-[var(--accent)]'}`}>
                                <Users size={16} /> Select All Staff
                            </button>

                            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 custom-scrollbar hide-scrollbar">
                                {departments.map(dept => (
                                    <button 
                                        key={dept} 
                                        onClick={() => handleDepartmentSelect(dept)}
                                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border-mid)] rounded-full text-[var(--text-body)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                                    >
                                        <Building2 size={12} /> {dept}
                                    </button>
                                ))}
                                <button
                                    onClick={() => handleRoleSelect(UserRole.ADMIN)}
                                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-100 border border-red-200 text-red-700 rounded-full hover:bg-red-200 transition-colors"
                                >
                                    <ShieldAlert size={12} /> Admins Only
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                            {isLoading ? (
                                <p className="p-4 text-center text-sm text-[var(--text-muted)]">Loading directory...</p>
                            ) : filteredUsers.length === 0 ? (
                                <p className="p-4 text-center text-sm text-[var(--text-muted)]">No users found.</p>
                            ) : (
                                filteredUsers.map(user => {
                                    const isSelected = isAllSelected || selectedIds.includes(user.uid);
                                    return (
                                        <div 
                                            key={user.uid}
                                            onClick={() => toggleUser(user.uid)}
                                            className={`flex items-center justify-between p-2.5 rounded-[var(--radius-md)] cursor-pointer transition-colors ${isSelected ? 'bg-[var(--accent-dim)]' : 'hover:bg-[var(--bg-surface)]'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--bg-surface)] to-[var(--border-mid)] border border-[var(--border-mid)] flex items-center justify-center text-xs font-bold text-[var(--text-heading)]">
                                                    {user.displayName?.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-semibold ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-heading)]'}`}>{user.displayName}</p>
                                                    <p className="text-xs text-[var(--text-muted)]">{user.department || 'Staff'} • {user.email}</p>
                                                </div>
                                            </div>
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-mid)]'}`}>
                                                {isSelected && <X size={10} className="text-white" />}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                    </div>
                </>
            )}
        </div>
    );
};
