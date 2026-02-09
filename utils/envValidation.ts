/**
 * Environment Variable Validation
 * Checks that all required environment variables are set before app starts
 */

interface EnvConfig {
    VITE_FIREBASE_API_KEY: string;
    VITE_FIREBASE_AUTH_DOMAIN: string;
    VITE_FIREBASE_PROJECT_ID: string;
    VITE_FIREBASE_STORAGE_BUCKET: string;
    VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    VITE_FIREBASE_APP_ID: string;
    VITE_FIREBASE_MEASUREMENT_ID: string;
    VITE_CLAUDE_API_KEY?: string; // Optional
}

const REQUIRED_ENV_VARS: (keyof EnvConfig)[] = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_MEASUREMENT_ID',
];

const OPTIONAL_ENV_VARS: (keyof EnvConfig)[] = [
    'VITE_CLAUDE_API_KEY',
];

export function validateEnvironment(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required variables
    for (const varName of REQUIRED_ENV_VARS) {
        if (!import.meta.env[varName]) {
            errors.push(`Missing required environment variable: ${varName}`);
        }
    }

    // Warn about optional variables
    for (const varName of OPTIONAL_ENV_VARS) {
        if (!import.meta.env[varName]) {
            console.warn(`⚠️ Optional environment variable not set: ${varName}. Some features may be disabled.`);
        }
    }

    if (errors.length > 0) {
        console.error('❌ Environment validation failed:');
        errors.forEach(err => console.error(`  - ${err}`));
        return { valid: false, errors };
    }

    console.log('✅ Environment variables validated successfully');
    return { valid: true, errors: [] };
}

export function getEnvConfig(): EnvConfig {
    return {
        VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
        VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
        VITE_FIREBASE_MEASUREMENT_ID: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
        VITE_CLAUDE_API_KEY: import.meta.env.VITE_CLAUDE_API_KEY,
    };
}
