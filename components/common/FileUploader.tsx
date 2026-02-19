import React, { useState, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { StorageService } from '../../services/storage';
import { toast } from 'react-hot-toast';

interface FileUploaderProps {
    onUploadComplete: (fileData: { id: string; name: string; url: string; type: string }) => void;
    onError?: (error: any) => void;
    accept?: string;
    maxSizeMB?: number;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
    onUploadComplete,
    onError,
    accept = "image/*,.pdf,.doc,.docx",
    maxSizeMB = 5
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    }, []);

    const validateFile = (file: File): boolean => {
        const sizeInMB = file.size / (1024 * 1024);
        if (sizeInMB > maxSizeMB) {
            const error = `File size exceeds ${maxSizeMB}MB limit.`;
            toast.error(error);
            onError?.(error);
            return false;
        }
        return true;
    };

    const processFile = async (file: File) => {
        if (!validateFile(file)) return;

        setIsUploading(true);
        setProgress(10); // Fake progress start

        try {
            // Simulate progress
            const interval = setInterval(() => {
                setProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            const result = await StorageService.upload(file);

            clearInterval(interval);
            setProgress(100);

            onUploadComplete(result);
            toast.success('File uploaded successfully!');
        } catch (error: any) {
            console.error("Upload failed", error);

            let msg = error.message || 'Upload failed';

            // Handle Appwrite Permission Errors
            if (error.code === 401 || error.code === 403) {
                msg = "Upload failed. Check Appwrite Storage Permissions (Read/Create/Update/Delete).";
                console.warn("Permission Error: Please ensure the Storage Bucket has 'Any' or 'Users' role with full permissions.");
            }

            toast.error(msg);
            onError?.(error);
        } finally {
            setIsUploading(false);
            setProgress(0);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    return (
        <div
            className={`
                relative border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 ease-in-out
                ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary/50'}
                ${isUploading ? 'opacity-50 pointer-events-none' : ''}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleChange}
                accept={accept}
                disabled={isUploading}
            />

            <div className="flex flex-col items-center justify-center space-y-3">
                {isUploading ? (
                    <>
                        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                        <p className="text-sm font-medium text-gray-600">Uploading... {progress}%</p>
                    </>
                ) : (
                    <>
                        <div className="p-3 bg-gray-100 rounded-full">
                            <Upload className="w-6 h-6 text-gray-500" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-700">
                                Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                PDF, Excel, Word, Images (max {maxSizeMB}MB)
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
