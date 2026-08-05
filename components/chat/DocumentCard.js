/**
 * DOCUMENT CARD COMPONENT
 * Displays generated documents (Excel, CSV, Word, PPT) with download functionality
 */

'use client';

import { FileText, Download, FileSpreadsheet, FileCode, Presentation } from 'lucide-react';

const DOCUMENT_ICONS = {
  xlsx: FileSpreadsheet,
  csv: FileCode,
  docx: FileText,
  pptx: Presentation,
  default: FileText
};

const DOCUMENT_COLORS = {
  xlsx: 'bg-green-50 border-green-200 text-green-700',
  csv: 'bg-blue-50 border-blue-200 text-blue-700',
  docx: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  pptx: 'bg-orange-50 border-orange-200 text-orange-700',
  default: 'bg-gray-50 border-gray-200 text-gray-700'
};

export default function DocumentCard({ 
  fileName, 
  downloadUrl, 
  format = 'xlsx',
  contentType = 'excel',
  size,
  className = '' 
}) {
  const Icon = DOCUMENT_ICONS[format] || DOCUMENT_ICONS.default;
  const colorClass = DOCUMENT_COLORS[format] || DOCUMENT_COLORS.default;

  const handleDownload = () => {
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`rounded-xl border-2 ${colorClass} p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${colorClass} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{fileName}</p>
              <p className="text-xs opacity-70 mt-0.5">
                {contentType.toUpperCase()} File
                {size && ` • ${formatFileSize(size)}`}
              </p>
            </div>
            
            <button
              onClick={handleDownload}
              className="flex-shrink-0 px-3 py-1.5 bg-white/80 hover:bg-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
          
          <p className="text-xs mt-2 opacity-60">
            Click download to save this file to your device
          </p>
        </div>
      </div>
    </div>
  );
}
