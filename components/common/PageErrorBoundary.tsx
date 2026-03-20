import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from '../ui';

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
                <div className="min-h-screen flex items-center justify-center p-4 bg-navy-900 text-white relative overflow-hidden">
                    {/* Background Effects */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/10 rounded-full blur-3xl animate-pulse-slow"></div>
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 rounded-full blur-3xl animate-pulse-slow delay-1000"></div>
                    </div>

                    <div className="glass-panel p-8 md:p-12 rounded-2xl max-w-lg w-full border border-white/10 shadow-2xl text-center space-y-8 relative z-10 animate-fade-in-up">
                        <div className="relative mx-auto w-20 h-20">
                            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse"></div>
                            <div className="relative w-20 h-20 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-full flex items-center justify-center border border-red-500/30 shadow-inner">
                                <AlertTriangle className="text-red-400 drop-shadow-lg" size={40} />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h2 className="text-3xl font-bold font-heading bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                                Something went wrong
                            </h2>
                            <p className="text-gray-400 leading-relaxed">
                                We encountered an unexpected error while loading this page. Our team has been notified.
                                {this.props.routePath && (
                                    <span className="block mt-2 text-xs font-mono text-gray-500 bg-black/20 py-1 px-2 rounded-lg w-fit mx-auto border border-white/5">
                                        Route: {this.props.routePath}
                                    </span>
                                )}
                            </p>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="bg-black/40 p-4 rounded-xl text-left overflow-auto max-h-48 text-xs font-mono text-red-300 border border-red-500/20 shadow-inner custom-scrollbar">
                                {this.state.error.toString()}
                                {this.state.error.stack && (
                                    <div className="mt-2 pt-2 border-t border-red-500/20 opacity-70">
                                        {this.state.error.stack.split('\n')[0]}
                                        <br />...
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                            <Button
                                onClick={this.handleReload}
                                variant="primary"
                                size="lg"
                                leftIcon={<RefreshCcw size={18} />}
                            >
                                Try Again
                            </Button>
                            <Button
                                onClick={this.handleGoHome}
                                variant="secondary"
                                size="lg"
                                leftIcon={<Home size={18} />}
                            >
                                Dashboard
                            </Button>
                        </div>

                        <div className="pt-6 border-t border-white/5">
                            <a
                                href="mailto:support@rsasystem.com?subject=Application Error Report"
                                className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium flex items-center justify-center gap-1"
                            >
                                Report this issue to support
                            </a>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default PageErrorBoundary;
