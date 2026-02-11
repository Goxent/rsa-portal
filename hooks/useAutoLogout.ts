import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const useAutoLogout = () => {
    const { logout } = useAuth();

    useEffect(() => {
        const checkAutoLogout = () => {
            const now = new Date();
            // Check if it's exactly 12:00 AM (00:00) with some tolerance
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                // Ensure we only trigger once per day near midnight
                // In production, you might want to store a flag in localStorage "logged_out_date"
                const lastLogoutDate = localStorage.getItem('last_auto_logout');
                const todayStr = now.toLocaleDateString();

                if (lastLogoutDate !== todayStr) {
                    console.log("Auto-logout triggered at midnight");
                    localStorage.setItem('last_auto_logout', todayStr);
                    logout();
                    window.location.reload(); // Force full reload to clear state
                }
            }
        };

        // Check every minute
        const interval = setInterval(checkAutoLogout, 60000);

        // Also check on mount
        checkAutoLogout();

        return () => clearInterval(interval);
    }, [logout]);
};
