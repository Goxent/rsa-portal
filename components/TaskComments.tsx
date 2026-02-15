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
        <div className="flex flex-col h-full max-h-[400px]">
            <div className="flex items-center gap-2 mb-4 text-gray-300">
                <MessageSquare size={16} className="text-brand-400" />
                <h3 className="font-bold text-sm">Comments & Activity</h3>
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-gray-400">{comments.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4 pr-2 bg-black/20 rounded-xl p-4 border border-white/5">
                {comments.length === 0 ? (
                    <div className="text-center text-gray-500 text-xs py-8 italic">
                        No comments yet. Start the conversation!
                    </div>
                ) : (
                    comments.map(comment => {
                        const isMe = comment.userId === user?.uid;
                        return (
                            <div key={comment.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                <div className="shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-navy-700 border border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-300">
                                        {getInitials(comment.userName)}
                                    </div>
                                </div>
                                <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="text-xs font-bold text-gray-300">{comment.userName}</span>
                                        <span className="text-[10px] text-gray-500">{format(new Date(comment.createdAt), 'MMM d, h:mm a')}</span>
                                    </div>
                                    <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${isMe
                                            ? 'bg-brand-600/20 text-brand-100 border border-brand-500/30 rounded-tr-none'
                                            : 'bg-white/5 text-gray-200 border border-white/10 rounded-tl-none'
                                        }`}>
                                        {comment.text}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={commentsEndRef} />
            </div>

            {!readOnly && (
                <div className="relative">
                    {showMentions && filteredUsers.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-navy-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-20">
                            <div className="px-3 py-2 bg-white/5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                Mention Staff
                            </div>
                            {filteredUsers.map(u => (
                                <button
                                    key={u.uid}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-brand-600/20 hover:text-white flex items-center gap-2 transition-colors"
                                    onClick={() => addMention(u.displayName, u.uid)}
                                >
                                    <div className="w-5 h-5 rounded-full bg-navy-700 flex items-center justify-center text-[8px]">
                                        {getInitials(u.displayName)}
                                    </div>
                                    {u.displayName}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2 items-end bg-white/5 p-2 rounded-xl border border-white/10 focus-within:border-brand-500/50 focus-within:ring-1 focus-within:ring-brand-500/20 transition-all">
                        <textarea
                            ref={textareaRef}
                            value={newComment}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            placeholder="Write a comment... use @ to mention"
                            className="flex-1 bg-transparent border-none outline-none text-sm text-white resize-none max-h-24 custom-scrollbar placeholder-gray-500 py-1"
                            rows={1}
                        />
                        <button
                            onClick={handleSubmit}
                            disabled={!newComment.trim()}
                            className="p-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-lg"
                        >
                            <Send size={14} />
                        </button>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 pl-2 flex items-center gap-2">
                        <span className="flex items-center"><AtSign size={10} className="mr-0.5" /> Mention staff</span>
                        <span>•</span>
                        <span>Enter to send</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskComments;
