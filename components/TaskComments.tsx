import React, { useState, useRef, useEffect } from 'react';
import { Send, UserCircle2, MessageSquare, AtSign } from 'lucide-react';
import { TaskComment, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

interface TaskCommentsProps {
    comments?: TaskComment[];
    users: UserProfile[];
    onAddComment: (comment: TaskComment) => void;
    readOnly?: boolean;
}

const TaskComments: React.FC<TaskCommentsProps> = ({ comments = [], users, onAddComment, readOnly = false }) => {
    const { user } = useAuth();
    const [newComment, setNewComment] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [comments]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setNewComment(val);

        // Simple mention trigger detection (last word starting with @)
        const lastWord = val.split(' ').pop();
        if (lastWord && lastWord.startsWith('@') && lastWord.length > 1) {
            setShowMentions(true);
            setMentionQuery(lastWord.substring(1));
        } else {
            setShowMentions(false);
        }
    };

    const addMention = (userName: string, userId: string) => {
        const words = newComment.split(' ');
        words.pop(); // Remove the partial mention
        const updatedText = [...words, `@${userName} `].join(' ');
        setNewComment(updatedText);
        setShowMentions(false);
        textareaRef.current?.focus();
    };

    const handleSubmit = () => {
        if (!newComment.trim() || !user) return;

        // Extract mentions
        const mentions: string[] = [];
        users.forEach(u => {
            if (newComment.includes(`@${u.displayName}`)) {
                mentions.push(u.uid);
            }
        });

        const comment: TaskComment = {
            id: Date.now().toString(),
            text: newComment.trim(),
            userId: user.uid,
            userName: user.displayName || 'Anonymous',
            createdAt: new Date().toISOString(),
            mentions
        };

        onAddComment(comment);
        setNewComment('');
    };

    const filteredUsers = users.filter(u =>
        u.displayName?.toLowerCase().includes(mentionQuery.toLowerCase())
    ).slice(0, 5);

    const getInitials = (name: string) => {
        return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
    };

    return (
        <div className="flex flex-col h-full max-h-[500px]">
            <div className="flex items-center gap-2 mb-3 text-slate-300 px-1">
                <MessageSquare size={14} className="text-amber-500" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Comments & Activity</h3>
                {comments.length > 0 && (
                    <span className="text-[10px] font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-slate-300">
                        {comments.length}
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 mb-4 pr-1 px-1">
                {comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-60">
                        <MessageSquare size={24} className="text-slate-600 mb-3" />
                        <span className="text-[12px] font-medium text-slate-500 italic">
                            No comments yet. Start the conversation!
                        </span>
                    </div>
                ) : (
                    comments.map(comment => {
                        const isMe = comment.userId === user?.uid;
                        return (
                            <div key={comment.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} group/comment`}>
                                <div className="shrink-0 mt-1">
                                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-black shadow-sm
                                        ${isMe ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                                        {getInitials(comment.userName)}
                                    </div>
                                </div>
                                <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-baseline gap-2 mb-1 px-1">
                                        <span className="text-[11px] font-bold text-slate-300">{comment.userName}</span>
                                        <span className="text-[9px] font-medium text-slate-500">{format(new Date(comment.createdAt), 'MMM d, h:mm a')}</span>
                                    </div>
                                    <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm
                                        ${isMe
                                            ? 'bg-amber-500/10 text-amber-50 border border-amber-500/20 rounded-tr-sm'
                                            : 'bg-white/[0.03] text-slate-200 border border-white/[0.05] rounded-tl-sm'
                                        }`}
                                    >
                                        {comment.text.split(/(@[\w\s]+)/g).map((part, i) => {
                                            if (part.startsWith('@')) {
                                                return <span key={i} className="text-amber-400 font-semibold bg-amber-500/10 px-1 py-0.5 rounded">{part}</span>;
                                            }
                                            return <span key={i}>{part}</span>;
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={commentsEndRef} />
            </div>

            {!readOnly && (
                <div className="relative mt-auto">
                    {showMentions && filteredUsers.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30 transform origin-bottom-left transition-all">
                            <div className="px-3 py-2 bg-black/40 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                                Mention Staff
                            </div>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {filteredUsers.map(u => (
                                    <button
                                        key={u.uid}
                                        className="w-full text-left px-3 py-2 text-[12px] font-medium text-slate-300 hover:bg-amber-500/10 hover:text-amber-300 flex items-center gap-2.5 transition-colors border-b border-white/[0.02] last:border-0"
                                        onClick={() => addMention(u.displayName, u.uid)}
                                    >
                                        <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[8px] font-black">
                                            {getInitials(u.displayName)}
                                        </div>
                                        {u.displayName}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-2 bg-black/20 p-2.5 rounded-xl border border-white/10 focus-within:border-amber-500/40 focus-within:ring-1 focus-within:ring-amber-500/10 transition-all shadow-inner relative group/input">
                        <textarea
                            ref={textareaRef}
                            value={newComment}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            placeholder="Write a comment... use @ to mention"
                            className="w-full bg-transparent border-none outline-none text-[13px] text-slate-200 resize-none max-h-32 custom-scrollbar placeholder-slate-600 px-1 leading-relaxed"
                            rows={newComment.split('\n').length > 1 ? Math.min(newComment.split('\n').length, 5) : 1}
                        />
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                                <span className="flex items-center gap-1"><AtSign size={10} className="text-slate-400" /> Mention</span>
                                <span className="w-1 h-1 rounded-full bg-slate-700" />
                                <span>Enter to send</span>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={!newComment.trim()}
                                className="p-1.5 px-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-all shadow-md font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
                            >
                                Send <Send size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskComments;
