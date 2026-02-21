import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

// 30 minutes of inactivity
const TIMEOUT_MS = 30 * 60 * 1000;

export const useAutoLogout = () => {
    const { logout } = useAuth();
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const handleLogout = async () => {
            console.log("Auto-logout triggered due to inactivity");
            try {
                await logout();
                window.location.href = '/#/login';
            } catch (err) {
                console.error("Logout failed", err);
                window.location.href = '/#/login';
            }
        };

        const resetTimer = () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(handleLogout, TIMEOUT_MS);
        };

        // Initialize timer
        resetTimer();

        // Listen for user activity
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => {
            window.addEventListener(event, resetTimer, { passive: true });
        });

        // Keep the midnight check
        const checkMidnightLogout = () => {
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() <= 5) {
                const todayStr = now.toLocaleDateString();
                const lastLogoutDate = localStorage.getItem('last_auto_logout');
                if (lastLogoutDate !== todayStr) {
                    localStorage.setItem('last_auto_logout', todayStr);
                    handleLogout();
                }
            }
        };

        const interval = setInterval(checkMidnightLogout, 60000);
        checkMidnightLogout();

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            clearInterval(interval);
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [logout]);
};
