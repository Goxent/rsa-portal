import { TaskTemplate } from '../types';

interface AIConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  apiKey: string;
}

const STORAGE_KEY = 'rsa_ai_config';

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export const AiService = {
  // Save API configuration to local storage (client-side only for privacy)
  saveConfig: (config: AIConfig) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  },

  getConfig: (): AIConfig | null => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);

    // Auto-detect provider from environment variables
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const anthropicKey = import.meta.env.VITE_CLAUDE_API_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY;
    const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (geminiKey) return { provider: 'gemini', apiKey: geminiKey };
    if (anthropicKey) return { provider: 'anthropic', apiKey: anthropicKey };
    if (openaiKey) return { provider: 'openai', apiKey: openaiKey };

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

    const provider = config?.provider || 'gemini'; // Default if not configured but env var exists
    const apiKey = config?.apiKey || '';

    if (!apiKey) {
      // Fail gracefully if no key is found
      return "AI Insight is unavailable (Reference: MISSING_KEY). Please add an API Key in settings.";
    }

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
        const errorMessage = errorData.error || 'AI Service Error';

        if (errorMessage.includes('credit balance is too low') || errorMessage.includes('insufficient_quota')) {
          throw new QuotaExceededError('AI Service quota exceeded. Please upgrade your plan or check API keys.');
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.result;

    } catch (error: any) {
      console.warn("AI Service Quota Exceeded:", error.message);
      if (error instanceof QuotaExceededError) {
        throw error;
      }
      // Re-throw specific error to be handled by UI
      if (error.message?.includes('credit balance is too low')) {
        throw new QuotaExceededError('AI Service quota exceeded. Please upgrade your plan or check API keys.');
      }
      throw error;
    }
  },

  researchConcept: async (topic: string, question: string, context: string): Promise<string> => {
    const fullPrompt = `Topic: ${topic}\nQuestion: ${question}`;
    return AiService.generateContent(fullPrompt, context);
  }
};
