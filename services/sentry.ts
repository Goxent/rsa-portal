import * as Sentry from "@sentry/react";

export const initSentry = () => {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

    if (!sentryDsn) {
        console.warn("⚠️ Sentry DSN not configured. Error tracking disabled.");
        return;
    }

    Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true,
            }),
        ],

        // Performance Monitoring
        tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring

        // Session Replay
        replaysSessionSampleRate: 0.1, // 10% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

        // Ignore expected errors
        ignoreErrors: [
            'ResizeObserver loop limit exceeded',
            'Non-Error promise rejection captured',
        ],

        beforeSend(event, hint) {
            // Don't send events in development
            if (import.meta.env.DEV) {
                console.error('Sentry Error (not sent in dev):', hint.originalException || hint.syntheticException);
                return null;
            }
            return event;
        },
    });

    console.info("✅ Sentry error tracking initialized");
};

// Helper to manually capture exceptions
export const captureException = (error: Error, context?: Record<string, any>) => {
    Sentry.captureException(error, {
        extra: context,
    });
};

// Helper to add user context
export const setUserContext = (user: { uid: string; email: string | null; displayName: string | null; role: string }) => {
    Sentry.setUser({
        id: user.uid,
        email: user.email || undefined,
        username: user.displayName || undefined,
        role: user.role,
    });
};

// Helper to clear user context on logout
export const clearUserContext = () => {
    Sentry.setUser(null);
};
