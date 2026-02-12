import React, { useState } from 'react';
import { X, ExternalLink, Download, FileText } from 'lucide-react';

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

    // For Office docs, we can use Google Docs Viewer if the URL is public/accessible
    // If usage is strictly internal/private, this might fail without signed URLs, 
    // but Appwrite view/download URLs are usually accessible if permissions allow.
    // We'll use the 'url' (view) for Google Docs.
    const isOffice = !isImage && !isPdf;
    const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(downloadUrl || url)}&embedded=true`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 truncate max-w-md">{title}</h3>
                            <p className="text-xs text-gray-500 capitalize">{type} Document</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                        <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                            title="Open in New Tab"
                        >
                            <ExternalLink size={20} />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden bg-gray-100 relative items-center justify-center flex">
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
                            src={googleDocsUrl}
                            className="w-full h-full border-0"
                            title="Office Document Viewer"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
