import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Mock Firebase
vi.mock('./services/firebase', () => ({
    auth: {},
    db: {},
    AuthService: {
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
        getAllClients: vi.fn(),
        getAllTasks: vi.fn(),
        saveTask: vi.fn(),
        updateUserProfile: vi.fn(),
    },
}));

// Mock Google GenAI
vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn(),
    Type: {
        ARRAY: 'array',
        STRING: 'string',
        OBJECT: 'object',
    },
}));
