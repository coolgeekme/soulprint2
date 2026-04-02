'use client';
import { X, FileText, Image as ImageIcon, Code, Film, Scissors } from 'lucide-react';

function AttachmentPill({ att, onRemove, onGenerateJson, onEditVideo }) {
  const isImage = att.type === 'image';
  const isVideo = att.type === 'video';
  return (
    <div className="relative group">
      {isImage ? (
        <div className="relative">
          <img 
            src={`data:${att.mimeType};base64,${att.base64}`} 
            alt={att.name} 
            className="w-16 h-16 object-cover rounded-xl border-2 border-orange-500/40 shadow-lg" 
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl px-1 py-0.5">
            <span className="text-[8px] text-white truncate block">{att.name}</span>
          </div>
          {/* Generate JSON button for images */}
          {onGenerateJson && (
            <button 
              onClick={() => onGenerateJson(att)}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-500 rounded-full text-[8px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-lg whitespace-nowrap"
              title="Generate image config JSON"
            >
              <Code className="w-2.5 h-2.5" /> JSON
            </button>
          )}
        </div>
      ) : isVideo ? (
        <div className="relative">
          <div className="w-16 h-16 bg-blue-500/10 border-2 border-blue-500/40 rounded-xl flex flex-col items-center justify-center p-1 shadow-lg">
            <Film className="w-5 h-5 text-blue-400" />
            <span className="text-[8px] text-gray-300 truncate w-full text-center mt-0.5">{att.name}</span>
            {att.size && (
              <span className="text-[7px] text-gray-500">{(att.size / (1024*1024)).toFixed(1)}MB</span>
            )}
          </div>
          {/* Edit Video button */}
          {onEditVideo && (
            <button 
              onClick={() => onEditVideo(att)}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-500 rounded-full text-[8px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-lg whitespace-nowrap"
              title="Edit video"
            >
              <Scissors className="w-2.5 h-2.5" /> Edit
            </button>
          )}
        </div>
      ) : (
        <div className="w-16 h-16 bg-white/10 border-2 border-orange-500/40 rounded-xl flex flex-col items-center justify-center p-1 shadow-lg">
          <FileText className="w-5 h-5 text-orange-400" />
          <span className="text-[8px] text-gray-300 truncate w-full text-center mt-0.5">{att.name}</span>
        </div>
      )}
      <button 
        onClick={onRemove} 
        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-3 h-3 text-white" />
      </button>
    </div>
  );
}

export default AttachmentPill;
