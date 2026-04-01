/**
 * Security Hardening Utilities
 * Deterrents against casual code inspection and DevTools usage.
 */

export const initSecurityGuard = () => {
    // Only apply these in production
    if (import.meta.env.DEV) return;

    // 1. Disable Right Click (Context Menu)
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // 2. Disable Common Inspect Element Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        // F12
        if (e.key === 'F12') {
            e.preventDefault();
        }

        // Ctrl+Shift+I / Cmd+Shift+I (Open DevTools)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
            e.preventDefault();
        }

        // Ctrl+Shift+J / Cmd+Shift+J (Open Console)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
            e.preventDefault();
        }

        // Ctrl+Shift+C / Cmd+Shift+C (Inspect Element)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault();
        }

        // Ctrl+U / Cmd+U (View Source)
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
        }
    });

    // 3. Clear Console periodically
    setInterval(() => {
        console.clear();
        console.log("%cStop!", "color: red; font-family: sans-serif; font-size: 4.5em; font-weight: bolder; text-shadow: #000 1px 1px;");
        console.log("%cThis is a restricted workspace. Unauthorized inspection is logged.", "color: #444; font-size: 16px;");
    }, 2000);

    // 4. Advanced DevTools Detection Strategy (Timing attack)
    const detectDevTools = () => {
        let isDevToolsOpen = false;
        const threshold = 160;
        const ts1 = performance.now();
        debugger; // This will pause if DevTools is open
        const ts2 = performance.now();
        if (ts2 - ts1 > threshold) {
            isDevToolsOpen = true;
        }

        if (isDevToolsOpen) {
            // Can choose to redirect, log out, or show warning overlay
            document.body.innerHTML = `
                <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #000; color: #f43f5e; font-family: sans-serif; flex-direction: column;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    <h1 style="margin-top: 24px;">Security Violation Detected</h1>
                    <p style="color: #666; margin-top: 12px;">Development tools are restricted in this environment.</p>
                </div>
            `;
        }
    };

    setInterval(detectDevTools, 3000);
};
