import React, { useState } from 'react';
import { X, ExternalLink, Download, FileText, Bot, Maximize, Minimize } from 'lucide-react';
import { AiDocumentAssistant } from './AiDocumentAssistant';

interface DocumentViewerProps {
    url: string;
    downloadUrl?: string; // Appwrite download URL
    type: string; // 'pdf', 'image', 'doc', etc.
    title: string;
    isOpen: boolean;
    onClose: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
    url,
    downloadUrl,
    type,
    title,
    isOpen,
    onClose
}) => {
    if (!isOpen) return null;

    const isImage = type === 'image' || type.startsWith('image/');
    const isPdf = type === 'pdf' || type === 'application/pdf' || url.endsWith('.pdf');

    // Detect if this is a Google Drive URL
    const isGoogleDrive = url.includes('drive.google.com');

    // For Office docs, we can use Google Docs Viewer if the URL is public/accessible
    // If it's a Google Drive URL, we use the /preview endpoint for a better embedding experience
    const isOffice = !isImage && !isPdf;
    const embedUrl = isGoogleDrive 
        ? url.replace('/view', '/preview') 
        : `https://docs.google.com/viewer?url=${encodeURIComponent(downloadUrl || url)}&embedded=true`;

    const [isAiOpen, setIsAiOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className={`relative w-full ${isFullscreen ? 'h-screen max-w-full rounded-none' : isAiOpen ? 'max-w-[98vw] h-[92vh] rounded-xl' : 'max-w-7xl h-[92vh] rounded-xl'} bg-white shadow-2xl flex flex-col overflow-hidden transition-all duration-300`}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 truncate max-w-md">{title}</h3>
                            <p className="text-xs text-gray-500 capitalize">{isGoogleDrive ? 'Google Drive' : type} Document</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isGoogleDrive && (
                            <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg text-sm font-bold flex items-center gap-2 border border-brand-200 transition-all mr-2"
                            >
                                <ExternalLink size={18} />
                                Edit Document
                            </a>
                        )}

                        <button
                            onClick={() => setIsAiOpen(!isAiOpen)}
                            className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${isAiOpen
                                ? 'bg-brand-600 text-white shadow-lg'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <Bot size={18} />
                            <span className="hidden sm:inline">Ask AI</span>
                        </button>
                        <div className="w-px h-8 bg-gray-200 mx-2"></div>

                        <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors" title="Toggle Fullscreen">
                            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                        </button>

                        {downloadUrl && (
                            <a
                                href={downloadUrl}
                                download
                                className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                                title="Download"
                            >
                                <Download size={20} />
                            </a>
                        )}
                        {!isGoogleDrive && (
                            <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                                title="Open in New Tab"
                            >
                                <ExternalLink size={20} />
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content Container */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Document View */}
                    <div className="flex-1 bg-gray-100 relative items-center justify-center flex overflow-hidden">
                        {isImage && (
                            <img
                                src={url}
                                alt={title}
                                className="max-w-full max-h-full object-contain p-4"
                            />
                        )}

                        {isPdf && (
                            <iframe
                                src={url}
                                className="w-full h-full border-0"
                                title="PDF Viewer"
                            />
                        )}

                        {isOffice && (
                            <iframe
                                src={embedUrl}
                                className="w-full h-full border-0"
                                title="Office Document Viewer"
                            />
                        )}
                    </div>

                    {/* AI Assistant Sidebar */}
                    {isAiOpen && (
                        <AiDocumentAssistant
                            documentTitle={title}
                            documentType={type}
                            isOpen={isAiOpen}
                            onClose={() => setIsAiOpen(false)}
                        />
                    )}
                </div>
            </div>
        </div>

    );
};
