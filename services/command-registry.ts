// Command Registry Service
// Central location to register and manage all commands

import { Command, CommandCategory, CATEGORY_ORDER } from '../types/command';

class CommandRegistryService {
    private commands: Map<string, Command> = new Map();
    private recentCommands: string[] = [];
    private readonly MAX_RECENT = 5;
    private readonly STORAGE_KEY = 'command-palette-recent';

    constructor() {
        this.loadRecent();
    }

    /**
     * Register a new command
     */
    register(command: Command): void {
        this.commands.set(command.id, command);
    }

    /**
     * Register multiple commands at once
     */
    registerAll(commands: Command[]): void {
        commands.forEach(cmd => this.register(cmd));
    }

    /**
     * Unregister a command by ID
     */
    unregister(id: string): void {
        this.commands.delete(id);
    }

    /**
     * Get all registered commands
     */
    getAll(): Command[] {
        return Array.from(this.commands.values()).filter(cmd => {
            if (cmd.visible) return cmd.visible();
            return true;
        });
    }

    /**
     * Get commands grouped by category
     */
    getGrouped(): Map<CommandCategory, Command[]> {
        const grouped = new Map<CommandCategory, Command[]>();

        // Initialize all categories
        CATEGORY_ORDER.forEach(cat => grouped.set(cat, []));

        // Group commands
        this.getAll().forEach(cmd => {
            const list = grouped.get(cmd.category) || [];
            list.push(cmd);
            grouped.set(cmd.category, list);
        });

        // Add recent commands
        const recentCmds = this.getRecentCommands();
        grouped.set('recent', recentCmds);

        return grouped;
    }

    /**
     * Get a command by ID
     */
    get(id: string): Command | undefined {
        return this.commands.get(id);
    }

    /**
     * Execute a command and track it as recent
     */
    async execute(id: string): Promise<void> {
        const command = this.get(id);
        if (!command) return;

        if (command.disabled?.()) return;

        try {
            await command.action();
            this.addToRecent(id);
        } catch (error) {
            console.error(`Error executing command ${id}:`, error);
            throw error;
        }
    }

    /**
     * Add command to recent list
     */
    private addToRecent(id: string): void {
        // Remove if already exists
        this.recentCommands = this.recentCommands.filter(cmdId => cmdId !== id);

        // Add to front
        this.recentCommands.unshift(id);

        // Trim to max
        if (this.recentCommands.length > this.MAX_RECENT) {
            this.recentCommands = this.recentCommands.slice(0, this.MAX_RECENT);
        }

        this.saveRecent();
    }

    /**
     * Get recent commands
     */
    getRecentCommands(): Command[] {
        return this.recentCommands
            .map(id => this.get(id))
            .filter((cmd): cmd is Command => cmd !== undefined);
    }

    /**
     * Clear recent commands
     */
    clearRecent(): void {
        this.recentCommands = [];
        localStorage.removeItem(this.STORAGE_KEY);
    }

    /**
     * Load recent from localStorage
     */
    private loadRecent(): void {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                this.recentCommands = JSON.parse(saved);
            }
        } catch {
            this.recentCommands = [];
        }
    }

    /**
     * Save recent to localStorage
     */
    private saveRecent(): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.recentCommands));
    }
}

// Singleton instance
export const CommandRegistry = new CommandRegistryService();
