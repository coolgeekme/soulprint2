'use client';

import React from 'react';

class MessageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[MessageError]', error?.message, errorInfo?.componentStack?.slice(0, 200));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          ⚠️ Error rendering this message. 
          <button 
            onClick={() => this.setState({ hasError: false })} 
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
