import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('theme');
        return (saved as Theme) || 'dark';
    });

    useEffect(() => {
        localStorage.setItem('theme', theme);
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

// Themed Toaster Component
import { Toaster } from 'react-hot-toast';

export const ThemedToaster: React.FC = () => {
    const { theme } = useTheme();

    return (
        <Toaster
            position="top-right"
            toastOptions={{
                className: '',
                style: {
                    // Carbon Ledger dark / Parchment Office light
                    background: theme === 'dark' ? '#1c1c1f' : '#ffffff',
                    color: theme === 'dark' ? '#e8e4dc' : '#1a1917',
                    backdropFilter: 'blur(12px)',
                    border: theme === 'dark'
                        ? '1px solid rgba(255, 255, 255, 0.06)'
                        : '1px solid rgba(0, 0, 0, 0.08)',
                    boxShadow: theme === 'dark'
                        ? '0 8px 32px rgba(0,0,0,0.4)'
                        : '0 4px 16px rgba(0,0,0,0.08)',
                    fontFamily: "'Geist', 'DM Sans', sans-serif",
                    fontSize: '0.875rem',
                },
                success: {
                    iconTheme: {
                        primary: theme === 'dark' ? '#2e8a61' : '#1a6e4d',
                        secondary: theme === 'dark' ? '#0c0c0e' : '#ffffff',
                    },
                },
                error: {
                    iconTheme: {
                        primary: theme === 'dark' ? '#c94f5e' : '#b83248',
                        secondary: theme === 'dark' ? '#0c0c0e' : '#ffffff',
                    },
                },
            }}
        />
    );
};
