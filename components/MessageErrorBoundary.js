'use client';

import React from 'react';

/**
 * MessageErrorBoundary: Catches errors in individual message rendering.
 * Instead of crashing the entire chat, shows a small error indicator
 * for the specific message that failed to render.
 * 
 * IMPORTANT: No auto-recovery. The previous auto-retry behavior caused
 * rapid error cascades that could crash the entire app. Users can
 * manually retry by clicking the button.
 */
class MessageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Render error' };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[MessageError]', error?.message, errorInfo?.componentStack?.slice(0, 200));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <span>⚠️ Error rendering this message.</span>
          <button 
            onClick={() => this.setState({ hasError: false, errorMessage: '' })} 
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
