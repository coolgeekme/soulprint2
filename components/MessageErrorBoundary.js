'use client';

import React from 'react';

/**
 * MessageErrorBoundary: Catches errors in individual message rendering.
 * Instead of crashing the entire chat, shows a small error indicator
 * for the specific message that failed to render.
 * Auto-recovers after a brief delay for transient streaming errors.
 */
class MessageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
    this._retryTimer = null;
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[MessageError]', error?.message, errorInfo?.componentStack?.slice(0, 200));
    
    const newCount = (this.state.errorCount || 0) + 1;
    this.setState({ errorCount: newCount });
    
    // Auto-retry once after 300ms for transient errors (e.g., SSE chunk parse failure)
    if (newCount <= 2) {
      this._retryTimer = setTimeout(() => {
        this.setState({ hasError: false });
      }, 300);
    }
  }

  componentWillUnmount() {
    if (this._retryTimer) clearTimeout(this._retryTimer);
  }

  render() {
    if (this.state.hasError) {
      // If we're auto-retrying (count <= 2), show a subtle loading state
      if (this.state.errorCount <= 2) {
        return (
          <div className="px-3 py-2 text-gray-500 text-xs animate-pulse">
            Loading message...
          </div>
        );
      }
      
      // After 2+ errors, show error with retry button
      return (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          ⚠️ Error rendering this message. 
          <button 
            onClick={() => this.setState({ hasError: false, errorCount: 0 })} 
            className="ml-2 underline hover:text-red-300"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default MessageErrorBoundary;
