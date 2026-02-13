import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Settings, X, Loader2, Sparkles, Key } from 'lucide-react';
import { AiService } from '../services/ai';
import toast from 'react-hot-toast';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ResearchAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    context?: string; // Context from the current page (e.g., Template content)
}

const ResearchAssistant: React.FC<ResearchAssistantProps> = ({ isOpen, onClose, context }) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Hello! I am your Research Assistant. I can help you draft templates, check compliance rules, or answer tax queries. How can I assist you today?',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [provider, setProvider] = useState<'openai' | 'anthropic' | 'gemini'>('openai');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            const config = AiService.getConfig();
            if (config) {
                setApiKey(config.apiKey);
                setProvider(config.provider);
            } else {
                setShowSettings(true);
            }
        }
    }, [isOpen]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSaveSettings = () => {
        if (!apiKey) {
            toast.error('Please enter an API Key');
            return;
        }
        AiService.saveConfig({ provider, apiKey });
        setShowSettings(false);
        toast.success('AI Settings Saved');
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const config = AiService.getConfig();
        if (!config) {
            setShowSettings(true);
            toast.error('Please configure API Key first');
            return;
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await AiService.generateContent(userMsg.content, context);
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error: any) {
            toast.error(error.message);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `⚠️ Error: ${error.message}. Please check your API Key in settings.`,
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-[#0f172a] shadow-2xl border-l border-white/10 z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Sparkles className="text-purple-400" size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Research Assistant</h3>
                        <p className="text-xs text-purple-300">Powered by {provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Claude' : 'Gemini'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <Settings size={18} />
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="p-4 bg-navy-900 border-b border-white/10 animate-in slide-in-from-top-2">
                    <h4 className="text-sm font-bold text-white mb-3 flex items-center">
                        <Key size={14} className="mr-2 text-amber-400" /> API Configuration
                    </h4>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Provider</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setProvider('openai')}
                                    className={`flex-1 py-2 rounded text-xs font-bold border ${provider === 'openai' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-white/5 text-gray-400 border-white/10'}`}
                                >
                                    OpenAI (GPT-4)
                                </button>
                                <button
                                    onClick={() => setProvider('anthropic')}
                                    className={`flex-1 py-2 rounded text-xs font-bold border ${provider === 'anthropic' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'bg-white/5 text-gray-400 border-white/10'}`}
                                >
                                    Anthropic (Claude)
                                </button>
                                <button
                                    onClick={() => setProvider('gemini')}
                                    className={`flex-1 py-2 rounded text-xs font-bold border ${provider === 'gemini' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-white/5 text-gray-400 border-white/10'}`}
                                >
                                    Google (Gemini)
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">API Key</label>
                            <input
                                type="password"
                                className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                placeholder={`sk-...`}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                            <p className="text-[10px] text-gray-500 mt-1">
                                Keys are stored locally in your browser and never sent to our servers.
                            </p>
                        </div>
                        <button
                            onClick={handleSaveSettings}
                            className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2 rounded-lg text-sm font-bold transition-all"
                        >
                            Save Configuration
                        </button>
                    </div>
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-navy-950/50">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user'
                            ? 'bg-brand-600 text-white rounded-br-none'
                            : 'bg-white/10 text-gray-200 rounded-bl-none border border-white/5'
                            }`}>
                            <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] uppercase font-bold">
                                {msg.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                                {msg.role === 'user' ? 'You' : 'Assistant'}
                            </div>
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white/5 rounded-2xl rounded-bl-none p-4 border border-white/5">
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <Loader2 size={16} className="animate-spin" />
                                Thinking...
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white/5 border-t border-white/10 backdrop-blur-md">
                <div className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Ask about tax laws, draft an email, or summarize this template..."
                        className="w-full bg-navy-900/50 text-white rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 border border-white/10 resize-none"
                        rows={2}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2 top-2 p-2 bg-brand-600 rounded-lg text-white hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <Send size={16} />
                    </button>
                </div>
                <div className="text-[10px] text-gray-500 text-center mt-2">
                    AI can make mistakes. Verify important information.
                </div>
            </div>
        </div>
    );
};

export default ResearchAssistant;
