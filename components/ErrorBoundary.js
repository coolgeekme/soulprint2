'use client';

import React from 'react';

/**
 * Global ErrorBoundary: Shows a recoverable crash screen for fatal errors.
 * 
 * IMPORTANT: This boundary does NOT auto-recover because auto-recovery causes
 * a full component tree re-mount, which destroys all state (including active
 * streaming connections, messages, etc.). Instead, it provides manual recovery
 * options.
 * 
 * For transient errors during streaming/rendering, use MessageErrorBoundary
 * or SafeSection which are scoped to individual UI sections.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    // Catch unhandled promise rejections - PREVENT app crash
    this._onUnhandledRejection = (event) => {
      console.error('[ErrorBoundary] Unhandled rejection:', event?.reason);
      // Prevent the rejection from propagating
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', this._onUnhandledRejection);

    // Catch runtime errors that React doesn't catch
    this._onError = (event) => {
      if (event.message && !event.message.includes('Script error')) {
        console.error('[ErrorBoundary] Global error:', event.message);
      }
      // Prevent TypeError / ReferenceError from crashing the app
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
    if (this._onUnhandledRejection) window.removeEventListener('unhandledrejection', this._onUnhandledRejection);
    if (this._onError) window.removeEventListener('error', this._onError);
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error?.message, errorInfo?.componentStack?.slice(0, 500));
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/chat';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
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
