import React from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-6 text-white">
            <div className="glass-modal rounded-2xl p-8 max-w-md text-center border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                    <AlertTriangle className="text-red-400" size={32} />
                </div>

                <h2 className="text-xl font-bold text-white mb-3">
                    Something went wrong
                </h2>

                <p className="text-gray-400 text-sm mb-6">
                    An unexpected error occurred. Please try again or contact support if the problem persists.
                </p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6 text-left overflow-auto max-h-40 custom-scrollbar">
                        <p className="text-red-300 text-xs font-mono break-all">
                            {error.message}
                        </p>
                    </div>
                )}

                <button
                    onClick={resetErrorBoundary}
                    className="flex items-center justify-center px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition-all shadow-lg hover:shadow-brand-500/25 mx-auto font-medium"
                >
                    <RefreshCw size={18} className="mr-2" />
                    Try Again
                </button>
            </div>
        </div>
    );
};

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
    return (
        <ReactErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => {
                // Reset the state of your app so the error doesn't happen again
                window.location.reload();
            }}
        >
            {children}
        </ReactErrorBoundary>
    );
};

export default ErrorBoundary;
