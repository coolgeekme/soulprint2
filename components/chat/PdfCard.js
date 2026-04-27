'use client';
import React, { useState } from 'react';
import { FileText, Download, Maximize2, Minimize2, X, ExternalLink } from 'lucide-react';

/**
 * PdfCard — Inline PDF viewer displayed in chat messages.
 * Shows a compact card with expand-to-fullscreen capability.
 */
export function PdfCard({ url, fileName, title }) {
  const [expanded, setExpanded] = useState(false);
  const displayName = title || fileName || 'Document.pdf';

  if (!url) return null;

  return (
    <>
      {/* Compact card in chat */}
      <div className="my-3 max-w-md">
        <div className="bg-[#1a2332] border border-white/10 rounded-xl overflow-hidden">
          {/* PDF Preview — embedded iframe */}
          <div className="relative w-full bg-white" style={{ height: '320px' }}>
            <iframe
              src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full border-0"
              title={displayName}
              loading="lazy"
            />
            {/* Expand overlay */}
            <button
              onClick={() => setExpanded(true)}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
              title="View full screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Info bar */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="p-2 rounded-lg bg-red-500/15">
              <FileText className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white truncate">{displayName}</p>
              <p className="text-[11px] text-gray-500">PDF Document</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setExpanded(true)}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="View full screen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href={url}
                download={fileName || 'document.pdf'}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen modal viewer */}
      {expanded && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 bg-[#0f1419] border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-red-500/15">
                <FileText className="w-4 h-4 text-red-400" />
              </div>
              <span className="text-white font-medium text-sm">{displayName}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in new tab
              </a>
              <a
                href={url}
                download={fileName || 'document.pdf'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
              <button
                onClick={() => setExpanded(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* PDF Viewer */}
          <div className="flex-1 p-4">
            <iframe
              src={url}
              className="w-full h-full rounded-lg border border-white/10"
              title={displayName}
            />
          </div>
        </div>
      )}
    </>
  );
}
