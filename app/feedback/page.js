'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, X, Loader2, Send, Upload, ArrowLeft } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function FeedbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null = loading, true/false = determined
  const fileInputRef = useRef(null);

  // Check if user is logged in
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  const handleAttachmentSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1];
      setAttachment({
        name: file.name,
        mimeType: file.type,
        base64,
        preview: ev.target.result,
      });
      setError('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim() || message.trim().length < 5) {
      setError('Please enter at least 5 characters');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      const payload = {
        message: message.trim(),
        category,
        rating: rating > 0 ? rating : null,
      };
      
      if (attachment) {
        payload.attachment = {
          name: attachment.name,
          mimeType: attachment.mimeType,
          base64: attachment.base64,
        };
      }
      
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const res = await fetch('/api/user-feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Loading state
  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center px-4">
        <div className="bg-gradient-to-br from-[#111] to-[#1a1a1a] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🙏</div>
          <h3 className="text-xl font-semibold text-white mb-2">Thank You!</h3>
          <p className="text-gray-400 mb-6">Your feedback has been submitted. We truly appreciate you taking the time to help us improve SoulPrint!</p>
          <button
            onClick={() => router.push('/chat')}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors"
          >
            Go to SoulPrint
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg py-8 px-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15)_0%,transparent_70%)]" />
      
      <div className="relative z-10 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <SoulPrintLogo size={56} />
          <h1 className="font-condensed font-black text-white text-2xl tracking-[0.15em] mt-4 uppercase">
            Share Your Feedback
          </h1>
          <p className="text-gray-400 text-sm mt-2 text-center">
            Help us make SoulPrint better for everyone
          </p>
        </div>

        {/* Not logged in notice */}
        {!isLoggedIn && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
            <p className="text-blue-400 text-sm text-center">
              💡 You're submitting feedback anonymously. 
              <button 
                onClick={() => router.push('/auth')}
                className="text-blue-300 underline ml-1 hover:text-white"
              >
                Sign in
              </button> to include your account info.
            </p>
          </div>
        )}

        {/* Feedback Form */}
        <div className="bg-gradient-to-br from-[#111] to-[#1a1a1a] border border-white/10 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Category */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">What's this about?</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'general', label: '💬 General', desc: 'General feedback' },
                  { id: 'bug', label: '🐛 Bug Report', desc: 'Something broken' },
                  { id: 'feature', label: '💡 Feature Idea', desc: 'Suggest something' },
                  { id: 'other', label: '📝 Other', desc: 'Something else' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-3 py-2 rounded-xl text-sm transition-all ${
                      category === cat.id 
                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 border' 
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Your Feedback</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind... What's working well? What could be better? Any ideas?"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-orange-500/50 outline-none transition-colors min-h-[140px] resize-none"
                required
              />
            </div>

            {/* Attachment */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Screenshot (optional)</label>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAttachmentSelect} 
                accept="image/*" 
                className="hidden" 
              />
              
              {attachment ? (
                <div className="relative inline-block">
                  <img 
                    src={attachment.preview} 
                    alt="Screenshot preview" 
                    className="w-32 h-24 object-cover rounded-xl border-2 border-orange-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <p className="text-xs text-gray-500 mt-1 truncate max-w-[128px]">{attachment.name}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-dashed border-white/20 rounded-xl text-gray-400 hover:bg-white/10 hover:border-white/30 transition-all w-full"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm">Click to attach a screenshot</span>
                </button>
              )}
              <p className="text-xs text-gray-600 mt-1">Max 5MB • PNG, JPG, GIF</p>
            </div>

            {/* Rating */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">How's your experience so far? (optional)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(rating === star ? 0 : star)}
                    className={`text-3xl transition-transform hover:scale-110 ${star <= rating ? 'text-orange-400' : 'text-gray-700'}`}
                  >
                    ★
                  </button>
                ))}
                {rating > 0 && <span className="text-sm text-gray-500 ml-2 self-center">{rating}/5</span>}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Feedback
                </>
              )}
            </button>
            
            <p className="text-xs text-gray-600 text-center">
              Your feedback helps us improve SoulPrint for everyone. Thank you! 🧡
            </p>
          </form>
        </div>

        {/* Back to app link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/chat')}
            className="text-gray-500 hover:text-white text-sm transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to SoulPrint
          </button>
        </div>
      </div>
    </div>
  );
}
