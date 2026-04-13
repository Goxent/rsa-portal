import React, { useState, useRef, useEffect } from 'react';
import { Bold, Italic, List, Edit3, Eye } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface ActionDetailEditorProps {
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

const ActionDetailEditor: React.FC<ActionDetailEditorProps> = ({
    value,
    onChange,
    disabled = false,
    placeholder = "Describe your actions..."
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.max(60, textareaRef.current.scrollHeight)}px`;
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [value]);

    return (
        <div className="group relative w-full flex flex-col border border-slate-200 dark:border-white/5 rounded-xl bg-white/50 dark:bg-black/20 overflow-hidden transition-all hover:border-brand-500/30">
            <div className="relative min-h-[60px] flex flex-col">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="w-full bg-transparent px-4 py-3 text-xs leading-relaxed text-slate-700 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-700 focus:outline-none resize-none transition-all scrollbar-hide border-none"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            const start = e.currentTarget.selectionStart;
                            const text = e.currentTarget.value;
                            const beforeCursor = text.substring(0, start);
                            const lastLine = beforeCursor.split('\n').pop() || '';
                            
                            // Regex to check for bullet patterns: •, -, *, 1., etc.
                            const bulletRegex = /^(\s*([•\-*])\s*)/;
                            const numberRegex = /^(\s*(\d+)\.\s*)/;
                            
                            const bulletMatch = lastLine.match(bulletRegex);
                            const numberMatch = lastLine.match(numberRegex);
                            
                            if (bulletMatch) {
                                e.preventDefault();
                                const prefix = bulletMatch[1];
                                if (lastLine.trim() === bulletMatch[2]) {
                                    const newText = text.substring(0, start - lastLine.length) + text.substring(start);
                                    onChange(newText);
                                } else {
                                    const newText = text.substring(0, start) + '\n' + prefix + text.substring(start);
                                    onChange(newText);
                                    setTimeout(() => textareaRef.current?.setSelectionRange(start + prefix.length + 1, start + prefix.length + 1), 0);
                                }
                            } else if (numberMatch) {
                                e.preventDefault();
                                const fullPrefix = numberMatch[1];
                                const number = parseInt(numberMatch[2]);
                                const indent = fullPrefix.substring(0, fullPrefix.indexOf(numberMatch[2]));
                                
                                if (lastLine.trim() === numberMatch[2] + '.') {
                                    const newText = text.substring(0, start - lastLine.length) + text.substring(start);
                                    onChange(newText);
                                } else {
                                    const nextNumber = number + 1;
                                    const nextPrefix = `${indent}${nextNumber}. `;
                                    const newText = text.substring(0, start) + '\n' + nextPrefix + text.substring(start);
                                    onChange(newText);
                                    setTimeout(() => textareaRef.current?.setSelectionRange(start + nextPrefix.length + 1, start + nextPrefix.length + 1), 0);
                                }
                            }
                        }
                    }}
                />
            </div>
        </div>
    );
};

export default ActionDetailEditor;
