'use client';

import React from 'react';

/**
 * Global ErrorBoundary with error reporting.
 * Captures the exact error + component stack and logs it visibly
 * so we can identify and fix the root cause.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    // Catch unhandled promise rejections
    this._onUnhandledRejection = (event) => {
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', this._onUnhandledRejection);
  }

  componentWillUnmount() {
    if (this._onUnhandledRejection) window.removeEventListener('unhandledrejection', this._onUnhandledRejection);
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Log the full error details to console AND try to send to backend
    const errorReport = {
      message: error?.message || 'Unknown error',
      stack: error?.stack?.slice(0, 1000) || '',
      componentStack: errorInfo?.componentStack?.slice(0, 1500) || '',
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
    };
    
    console.error('[CRASH REPORT]', JSON.stringify(errorReport, null, 2));
    
    // Try to log to backend for debugging
    try {
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport),
      }).catch(() => {});
    } catch (e) {}
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/chat';
  };

  render() {
    if (this.state.hasError) {
      const errMsg = this.state.error?.message || 'Unknown error';
      const componentStack = this.state.errorInfo?.componentStack || '';
      
      // Extract the component name from the stack
      const crashedComponent = componentStack
        .split('\n')
        .filter(line => line.trim().startsWith('at '))
        .slice(0, 3)
        .map(line => line.trim())
        .join(' → ');

      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="max-w-lg w-full text-center space-y-6">
            <div className="text-6xl">⚡</div>
            <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
            <p className="text-gray-400 text-sm">
              An unexpected error occurred. This usually resolves itself with a quick reload.
            </p>
            
            {/* Always show error details for debugging */}
            <div className="text-left p-3 bg-red-500/10 rounded-lg border border-red-500/20 max-h-48 overflow-auto">
              <p className="text-red-400 text-xs font-mono break-all">{errMsg}</p>
              {crashedComponent && (
                <p className="text-red-300/60 text-[10px] font-mono mt-2 break-all">{crashedComponent}</p>
              )}
            </div>
            
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={this.handleRetry}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
              >
                Go to Chat
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
