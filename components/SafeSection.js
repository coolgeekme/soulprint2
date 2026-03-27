'use client';

import React from 'react';

/**
 * SafeSection: A lightweight error boundary for wrapping UI sections.
 * Unlike the global ErrorBoundary that shows a full-screen error page,
 * SafeSection silently catches errors in its children and either shows
 * a fallback or nothing at all—preventing one broken section from
 * crashing the entire app.
 */
class SafeSection extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[SafeSection${this.props.name ? ': ' + this.props.name : ''}]`, error?.message, errorInfo?.componentStack?.slice(0, 300));
  }

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function' 
          ? this.props.fallback(() => this.setState({ hasError: false }))
          : this.props.fallback;
      }
      // Default: render nothing (section silently disappears rather than crashing the app)
      return null;
    }
    return this.props.children;
  }
}

export default SafeSection;
