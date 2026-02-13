import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
    routePath?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class PageErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error in page:', error, errorInfo);
    }

    private handleReload = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-navy-900 text-white">
                    <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-white/10 shadow-2xl text-center space-y-6">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                            <AlertTriangle className="text-red-400" size={32} />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold font-heading">Something went wrong</h2>
                            <p className="text-gray-400">
                                We encountered an error while loading this page.
                                {this.props.routePath && <span className="block mt-1 text-xs font-mono text-gray-500">Route: {this.props.routePath}</span>}
                            </p>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="bg-black/30 p-4 rounded-lg text-left overflow-auto max-h-40 text-xs font-mono text-red-300 border border-red-500/10">
                                {this.state.error.toString()}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={this.handleReload}
                                className="flex items-center justify-center px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-medium transition-colors"
                            >
                                <RefreshCcw size={16} className="mr-2" />
                                Try Again
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center justify-center px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors border border-white/10"
                            >
                                <Home size={16} className="mr-2" />
                                Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default PageErrorBoundary;
