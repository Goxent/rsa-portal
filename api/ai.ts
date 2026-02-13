import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const { provider, message, system, context, apiKey: clientApiKey } = req.body;

    // Prioritize Server Env Vars, fallback to Client provided key
    let apiKey = clientApiKey;
    if (!apiKey) {
        if (provider === 'openai') apiKey = process.env.VITE_OPENAI_API_KEY;
        if (provider === 'anthropic') apiKey = process.env.VITE_ANTHROPIC_API_KEY || process.env.VITE_CLAUDE_API_KEY;
        if (provider === 'gemini') apiKey = process.env.VITE_GEMINI_API_KEY;
    }

    if (!apiKey) {
        res.status(401).json({ error: 'API Key Missing' });
        return;
    }

    try {
        let result;

        if (provider === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    system: system || 'You are a helpful assistant.',
                    messages: [{ role: 'user', content: message }],
                    max_tokens: 1024
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Anthropic API Error');
            }

            const data = await response.json();
            result = data.content[0]?.text;

        } else if (provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: system || 'You are a helpful assistant.' },
                        { role: 'user', content: message }
                    ],
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'OpenAI API Error');
            }

            const data = await response.json();
            result = data.choices[0]?.message?.content;

        } else if (provider === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const finalPrompt = `${system}\n\nUser Question: ${message}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: finalPrompt }] }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Gemini API Error');
            }

            const data = await response.json();
            result = data.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
            throw new Error('Invalid Provider');
        }

        res.status(200).json({ result });

    } catch (error: any) {
        console.error('AI Proxy Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
