'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * SafeMarkdown: A crash-proof wrapper around ReactMarkdown.
 * 
 * Prevents the most common crash sources:
 * 1. remark-gfm 'inTable' crash with malformed tables (mitigated by downgrading to v3)
 * 2. Infinite re-render from unstable components prop
 * 3. Non-string content being passed
 * 4. Any unexpected rendering errors
 * 5. Extremely large content that could freeze the browser
 * 
 * If ReactMarkdown crashes, falls back to plain text rendering.
 */

// Maximum content length to pass to ReactMarkdown to prevent browser freezes
const MAX_MARKDOWN_LENGTH = 100000;

// Define components ONCE outside the component to prevent re-render loops
const markdownComponents = {
  p: ({ children }) => <p className="mb-3 last:mb-0 break-words">{children}</p>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-') || (typeof children === 'string' && children.includes('\n'));
    return isBlock
      ? <pre className="bg-sp-black p-3 sm:p-4 rounded-lg my-3 overflow-x-auto text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap break-words"><code>{children}</code></pre>
      : <code className="bg-white/10 px-1.5 py-0.5 rounded text-orange-300 text-[13px] sm:text-sm break-all">{children}</code>;
  },
  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1.5 mb-3">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1.5 mb-3">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline hover:text-orange-300 break-all">{children}</a>,
  h1: ({ children }) => <h1 className="text-lg sm:text-xl font-bold text-white mt-5 mb-3">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base sm:text-lg font-bold text-white mt-4 mb-2.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[15px] sm:text-base font-semibold text-white mt-3.5 mb-2">{children}</h3>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-orange-500/40 pl-4 my-3 italic text-gray-400">{children}</blockquote>,
  img: ({ src, alt }) => {
    try {
      return src ? <img src={src} alt={alt || ''} className="max-w-full rounded-lg my-3" loading="lazy" /> : null;
    } catch {
      return null;
    }
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full text-[13px] sm:text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-white/20 px-3 py-1.5 bg-white/5 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-white/10 px-3 py-1.5">{children}</td>,
};

// Memoize plugins array to prevent re-renders
const plugins = [remarkGfm];

class MarkdownErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('[SafeMarkdown] Rendering failed:', error?.message);
  }

  render() {
    if (this.state.hasError) {
      // Fallback: render as plain text with basic line breaks
      return (
        <div className="whitespace-pre-wrap break-words text-gray-200">
          {this.props.content || ''}
        </div>
      );
    }
    return this.props.children;
  }
}

function SafeMarkdown({ content, className }) {
  // Ensure content is always a valid string
  const safeContent = useMemo(() => {
    if (typeof content === 'string') {
      // Truncate extremely long content to prevent browser freeze
      let text = content;
      if (text.length > MAX_MARKDOWN_LENGTH) {
        text = text.slice(0, MAX_MARKDOWN_LENGTH) + '\n\n... (content truncated for display)';
      }
      // Auto-link bare URLs that aren't already in markdown link syntax or code blocks
      // Matches http(s) URLs not already inside []() or backticks
      text = text.replace(
        /(?<!\]\()(?<!\()(https?:\/\/[^\s\)<>\]`]+)/g,
        (match, url, offset) => {
          // Check if this URL is already inside a markdown link [text](url) or inline code `url`
          const before = text.slice(Math.max(0, offset - 200), offset);
          // Skip if inside markdown link syntax
          if (/\]\(\s*$/.test(before)) return match;
          // Skip if inside backtick code
          const backticksBefore = (before.match(/`/g) || []).length;
          if (backticksBefore % 2 === 1) return match;
          // Skip if already a markdown link text like [url]
          if (/\[$/.test(before.trimEnd())) return match;
          return `[${url}](${url})`;
        }
      );
      return text;
    }
    if (content == null) return '';
    try {
      return String(content);
    } catch {
      return '';
    }
  }, [content]);

  // Don't render ReactMarkdown for empty content
  if (!safeContent) return null;

  // For very short plain text (no markdown indicators and no URLs), skip ReactMarkdown entirely
  if (safeContent.length < 50 && !/[*_#|`\[\]~>-]/.test(safeContent) && !safeContent.includes('\n') && !safeContent.includes('http')) {
    return (
      <div className={className}>
        <p className="mb-3 last:mb-0 break-words">{safeContent}</p>
      </div>
    );
  }

  return (
    <MarkdownErrorBoundary content={safeContent}>
      <div className={className}>
        <ReactMarkdown remarkPlugins={plugins} components={markdownComponents}>
          {safeContent}
        </ReactMarkdown>
      </div>
    </MarkdownErrorBoundary>
  );
}

export default React.memo(SafeMarkdown);
