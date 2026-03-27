'use client';

import React from 'react';

/**
 * Global ErrorBoundary: Shows a crash screen ONLY for truly fatal errors.
 * For transient rendering errors (which are common with SSE streaming,
 * dynamic imports, etc.), it auto-recovers after a short delay.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0, autoRecovering: false };
    this._autoRecoverTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    // Catch unhandled promise rejections - PREVENT app crash
    this._onUnhandledRejection = (event) => {
      console.error('[ErrorBoundary] Unhandled rejection:', event.reason);
      event.preventDefault(); // Prevent the error from crashing the app
    };
    window.addEventListener('unhandledrejection', this._onUnhandledRejection);

    // Catch runtime errors that React doesn't catch
    this._onError = (event) => {
      // Only log non-CORS, non-network errors
      if (event.message && !event.message.includes('Script error')) {
        console.error('[ErrorBoundary] Global error:', event.message);
      }
      // Prevent error from propagating to cause crash
      if (event.error && (
        event.message?.includes('Cannot read properties of undefined') ||
        event.message?.includes('Cannot read properties of null') ||
        event.message?.includes('is not a function') ||
        event.message?.includes('is not defined')
      )) {
        event.preventDefault();
      }
    };
    window.addEventListener('error', this._onError);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this._onUnhandledRejection);
    window.removeEventListener('error', this._onError);
    if (this._autoRecoverTimer) clearTimeout(this._autoRecoverTimer);
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error?.message, errorInfo?.componentStack?.slice(0, 500));
    
    const newCount = this.state.errorCount + 1;
    this.setState({ errorCount: newCount });
    
    // Auto-recover for the first 3 errors (transient rendering issues)
    if (newCount <= 3) {
      this.setState({ autoRecovering: true });
      this._autoRecoverTimer = setTimeout(() => {
        this.setState({ hasError: false, error: null, autoRecovering: false });
      }, 500);
    }
    // After 3+ errors in rapid succession, show the crash screen
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorCount: 0, autoRecovering: false });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorCount: 0, autoRecovering: false });
    window.location.href = '/chat';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, autoRecovering: false });
  };

  render() {
    // If auto-recovering, show nothing briefly (prevents flash of error screen)
    if (this.state.autoRecovering) {
      return this.props.children;
    }

    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="text-6xl">⚡</div>
            <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
            <p className="text-gray-400 text-sm">
              An unexpected error occurred. This usually resolves itself with a quick reload.
            </p>
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
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <summary className="text-red-400 text-xs cursor-pointer">Error Details</summary>
                <pre className="text-red-300 text-[10px] mt-2 overflow-auto max-h-40 whitespace-pre-wrap">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
