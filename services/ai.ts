import { TaskTemplate } from '../types';

interface AIConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  apiKey: string;
}

const STORAGE_KEY = 'rsa_ai_config';

export const AiService = {
  // Save API configuration to local storage (client-side only for privacy)
  saveConfig: (config: AIConfig) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  },

  getConfig: (): AIConfig | null => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);

    // Fallback to Environment Variables
    if (import.meta.env.VITE_OPENAI_API_KEY) {
      return { provider: 'openai', apiKey: import.meta.env.VITE_OPENAI_API_KEY };
    }
    if (import.meta.env.VITE_ANTHROPIC_API_KEY || import.meta.env.VITE_CLAUDE_API_KEY) {
      return { provider: 'anthropic', apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || import.meta.env.VITE_CLAUDE_API_KEY };
    }
    if (import.meta.env.VITE_GEMINI_API_KEY) {
      return { provider: 'gemini', apiKey: import.meta.env.VITE_GEMINI_API_KEY };
    }

    return null;
  },

  clearConfig: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  generateContent: async (prompt: string, context?: string): Promise<string> => {
    const config = AiService.getConfig();
    // We prioritize local config but also allow env vars (handled by proxy if key is missing here)

    const systemPrompt = `You are an expert Audit & Tax Assistant for RSA (a CA Firm). 
        Context: ${context || 'General tax and audit queries.'}
        Provide professional, accurate, and concise responses. Format with Markdown.`;

    const provider = config?.provider || 'openai'; // Default if not configured but env var exists
    const apiKey = config?.apiKey || '';

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey, // Can be empty if relying on server env var
          message: prompt,
          system: systemPrompt,
          context
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI Service Error');
      }

      const data = await response.json();
      return data.result;

    } catch (error: any) {
      console.error("AI Service Error:", error);
      throw error;
    }
  },

  researchConcept: async (topic: string, question: string, context: string): Promise<string> => {
    const fullPrompt = `Topic: ${topic}\nQuestion: ${question}`;
    return AiService.generateContent(fullPrompt, context);
  }
};
