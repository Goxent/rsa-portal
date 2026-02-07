
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child component tree
 */
class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-dark-900 p-6">
                    <div className="glass-modal rounded-2xl p-8 max-w-md text-center">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="text-red-400" size={32} />
                        </div>

                        <h2 className="text-xl font-bold text-white mb-3">
                            Something went wrong
                        </h2>

                        <p className="text-gray-400 text-sm mb-6">
                            An unexpected error occurred. Please try again or contact support if the problem persists.
                        </p>

                        {this.state.error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6 text-left">
                                <p className="text-red-300 text-xs font-mono break-all">
                                    {this.state.error.message}
                                </p>
                            </div>
                        )}

                        <button
                            onClick={this.handleRetry}
                            className="btn-primary mx-auto"
                        >
                            <RefreshCw size={16} className="mr-2" />
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
