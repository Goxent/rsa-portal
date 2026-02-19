import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const useAutoLogout = () => {
    const { logout } = useAuth();

    useEffect(() => {
        const checkAutoLogout = () => {
            const now = new Date();
            // Check if it's between 12:00 AM (00:00) and 12:05 AM (00:05)
            // This provides a 5-minute window to catch the event
            if (now.getHours() === 0 && now.getMinutes() <= 5) {
                const todayStr = now.toLocaleDateString();
                const lastLogoutDate = localStorage.getItem('last_auto_logout');

                if (lastLogoutDate !== todayStr) {
                    console.log("Auto-logout triggered at midnight");
                    localStorage.setItem('last_auto_logout', todayStr);

                    logout().then(() => {
                        window.location.href = '/#/login';
                    }).catch(err => {
                        console.error("Logout failed", err);
                        // Force redirect anyway
                        window.location.href = '/#/login';
                    });
                }
            }
        };

        // Check every minute
        const interval = setInterval(checkAutoLogout, 60000);

        // Also check immediately on mount
        checkAutoLogout();

        return () => clearInterval(interval);
    }, [logout]);
};
