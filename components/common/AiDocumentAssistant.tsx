import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, AlertTriangle, X } from 'lucide-react';
import { AiService, QuotaExceededError } from '../../services/ai';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AiDocumentAssistantProps {
    documentTitle: string;
    documentType: string;
    isOpen: boolean;
    onClose: () => void;
}

export const AiDocumentAssistant: React.FC<AiDocumentAssistantProps> = ({
    documentTitle,
    documentType,
    isOpen,
    onClose
}) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: `Hi! I'm your AI Assistant. I can help you understand "${documentTitle}". What would you like to know?`,
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            // Context includes document info
            const context = `User is viewing a ${documentType} document titled "${documentTitle}". 
            Answer questions relevant to this context if possible. 
            If specific document content is not provided, give general advice based on the title and type.`;

            const response = await AiService.generateContent(userMessage.content, context);

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (err: any) {
            console.error(err);
            if (err instanceof QuotaExceededError || err.name === 'QuotaExceededError') {
                setError("AI Usage Limit Reached. Please upgrade your plan to continue using AI features.");
            } else {
                setError("Sorry, I encountered an error. Please try again later.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="w-80 md:w-96 border-l border-gray-200 bg-gray-50 flex flex-col h-full shrink-0 transition-all">
            {/* Header */}
            <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-brand-100 rounded-lg">
                        <Bot size={18} className="text-brand-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 text-sm">AI Copilot</h3>
                        <p className="text-[10px] text-gray-500">Powered by Gemini</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-gray-200' : 'bg-brand-100'
                            }`}>
                            {msg.role === 'user' ?
                                <User size={14} className="text-gray-600" /> :
                                <Bot size={14} className="text-brand-600" />
                            }
                        </div>
                        <div className={`rounded-xl p-3 text-sm max-w-[85%] shadow-sm ${msg.role === 'user'
                                ? 'bg-white text-gray-800 border border-gray-100'
                                : 'bg-brand-50 text-gray-800 border border-brand-100'
                            }`}>
                            <div className="prose prose-sm max-w-none">
                                {msg.content}
                            </div>
                            <div className="text-[10px] opacity-50 mt-1 text-right">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                            <Bot size={14} className="text-brand-600" />
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin text-brand-500" />
                            <span className="text-xs text-gray-500">Thinking...</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mx-4 p-3 bg-red-50 border border-red-100 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2">
                        <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="text-xs font-bold text-red-700 mb-1">Error</h4>
                            <p className="text-xs text-red-600">{error}</p>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
                <form onSubmit={handleSend} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about this document..."
                        className="w-full bg-gray-50 border-0 rounded-xl pl-4 pr-10 py-3 text-sm focus:ring-2 focus:ring-brand-500 transition-all placeholder-gray-400"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-2 p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-500 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors shadow-sm"
                    >
                        <Send size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
};
