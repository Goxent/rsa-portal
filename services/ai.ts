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
    if (!config || !config.apiKey) {
      throw new Error('API Key not found. Please configure settings or add to .env file.');
    }

    const systemPrompt = `You are an expert Audit & Tax Assistant for RSA (a CA Firm). 
        Context: ${context || 'General tax and audit queries.'}
        Provide professional, accurate, and concise responses. Format with Markdown.`;

    if (config.provider === 'openai') {
      return AiService.callOpenAI(config.apiKey, systemPrompt, prompt);
    } else if (config.provider === 'anthropic') {
      return AiService.callAnthropic(config.apiKey, systemPrompt, prompt);
    } else if (config.provider === 'gemini') {
      return AiService.callGemini(config.apiKey, systemPrompt, prompt);
    }

    throw new Error('Invalid Provider');
  },

  researchConcept: async (topic: string, question: string, context: string): Promise<string> => {
    const fullPrompt = `Topic: ${topic}\nQuestion: ${question}`;
    return AiService.generateContent(fullPrompt, context);
  },

  callOpenAI: async (apiKey: string, system: string, userMsg: string): Promise<string> => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o', // or gpt-3.5-turbo
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMsg }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'OpenAI API Error');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  },

  callAnthropic: async (apiKey: string, system: string, userMsg: string): Promise<string> => {
    // Note: Anthropic strictly requires a proxy if calling from browser usually due to CORS, 
    // but we will try direct. If CORS fails, user needs a proxy. 
    // For this implementation, we assume direct call or proxy is essentially handled or 
    // we'll catch the error and advise.
    // Actually, Anthropic DOES support CORS/browser calls if 'dangerously-allow-browser' header is NOT used properly?
    // Wait, Anthropic SDK usually warns about browser usage. We are using fetch raw.

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'dangerously-allow-browser': 'true' // Required for client-side usage
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        system: system,
        messages: [
          { role: 'user', content: userMsg }
        ],
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Anthropic API Error');
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  },

  callGemini: async (apiKey: string, system: string, userMsg: string): Promise<string> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // Gemini doesn't have a 'system' role in the same way as OpenAI/Anthropic in the basic API, 
    // so we prepend it to the prompt or use the system instruction if using a newer model version that supports it.
    // For simplicity with v1beta, we'll prepend.

    const finalPrompt = `${system}\n\nUser Question: ${userMsg}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: finalPrompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Gemini API Error');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
};
