import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Lightbulb } from 'lucide-react';
import { AiService } from '../../../services/ai';

const AiInsightWidget: React.FC = () => {
    const [insight, setInsight] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Check if we have a cached insight for today
        const cacheKey = `rsa_ai_insight_${new Date().toLocaleDateString()}`;
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
            setInsight(cached);
        } else {
            generateInsight();
        }
    }, []);

    const generateInsight = async () => {
        setLoading(true);
        try {
            const prompt = "Generate a concise, motivating, and professional tip for an Audit & Tax professional for today. Focus on productivity, compliance, or client relations. Max 2 sentences.";
            const result = await AiService.generateContent(prompt, "Daily Dashboard Insight");

            const cacheKey = `rsa_ai_insight_${new Date().toLocaleDateString()}`;
            localStorage.setItem(cacheKey, result);
            setInsight(result);
        } catch (error) {
            console.error("Failed to generate insight", error);
            setInsight("Review pending tasks and ensure all client communications are up to date.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel p-6 rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-900/20 to-indigo-900/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sparkles size={64} className="text-purple-400" />
            </div>

            <div className="relative z-10 flex gap-4 items-start">
                <div className="p-3 bg-purple-500/20 rounded-xl text-purple-300">
                    <Lightbulb size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-purple-200 uppercase tracking-widest mb-1 flex items-center gap-2">
                        AI Daily Insight
                        {loading && <RefreshCw size={12} className="animate-spin" />}
                    </h3>
                    <p className="text-lg text-white font-heading leading-relaxed">
                        {insight || "Generating your daily insight..."}
                    </p>
                </div>
                <button
                    onClick={generateInsight}
                    disabled={loading}
                    className="p-2 hover:bg-white/10 rounded-lg text-purple-300 transition-colors"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
            </div>
        </div>
    );
};

export default AiInsightWidget;
