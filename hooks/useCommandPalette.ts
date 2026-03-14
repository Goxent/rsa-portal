// useCommandPalette Hook
// Manages command palette state and filtering

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Fuse from 'fuse.js';
import { Command, CommandCategory, CATEGORY_ORDER } from '../types/command';
import { CommandRegistry } from '../services/command-registry';

interface UseCommandPaletteReturn {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    search: string;
    setSearch: (search: string) => void;
    filteredCommands: Command[];
    groupedCommands: Map<CommandCategory, Command[]>;
    executeCommand: (command: Command) => Promise<void>;
    recentCommands: Command[];
    clearSearch: () => void;
}

export const useCommandPalette = (controlledIsOpen?: boolean, onControlledClose?: () => void): UseCommandPaletteReturn => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const setIsOpen = onControlledClose || setInternalIsOpen;
    const [search, setSearch] = useState('');

    // Register global hotkey (Cmd+K / Ctrl+K)
    useHotkeys('mod+k', (e) => {
        e.preventDefault();
        setIsOpen(true);
    }, { enableOnFormTags: true });

    // Close on Escape
    useHotkeys('esc', () => {
        if (isOpen) {
            setIsOpen(false);
            setSearch('');
        }
    }, { enableOnFormTags: true, enabled: isOpen });

    // Get all commands
    const allCommands = useMemo(() => CommandRegistry.getAll(), []);

    // Setup Fuse.js for fuzzy search
    const fuse = useMemo(() => new Fuse(allCommands, {
        keys: [
            { name: 'title', weight: 0.5 },
            { name: 'keywords', weight: 0.3 },
            { name: 'subtitle', weight: 0.2 },
        ],
        threshold: 0.4,
        includeScore: true,
    }), [allCommands]);

    // Filter commands based on search
    const filteredCommands = useMemo(() => {
        if (!search.trim()) {
            return allCommands;
        }
        return fuse.search(search).map(result => result.item);
    }, [search, fuse, allCommands]);

    // Group filtered commands by category
    const groupedCommands = useMemo(() => {
        const grouped = new Map<CommandCategory, Command[]>();

        CATEGORY_ORDER.forEach(cat => grouped.set(cat, []));

        // Add recent if no search
        if (!search.trim()) {
            grouped.set('recent', CommandRegistry.getRecentCommands());
        }

        filteredCommands.forEach(cmd => {
            const list = grouped.get(cmd.category) || [];
            list.push(cmd);
            grouped.set(cmd.category, list);
        });

        return grouped;
    }, [filteredCommands, search]);

    // Execute command
    const executeCommand = useCallback(async (command: Command) => {
        try {
            await CommandRegistry.execute(command.id);
            setIsOpen(false);
            setSearch('');
        } catch (error) {
            console.error('Command execution failed:', error);
        }
    }, []);

    // Clear search
    const clearSearch = useCallback(() => setSearch(''), []);

    // Recent commands
    const recentCommands = useMemo(() => CommandRegistry.getRecentCommands(), [isOpen]);

    return {
        isOpen,
        setIsOpen,
        search,
        setSearch,
        filteredCommands,
        groupedCommands,
        executeCommand,
        recentCommands,
        clearSearch,
    };
};
