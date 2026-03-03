'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, CheckCircle, AlertCircle } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState('idle'); // idle, sending, success, error
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <SoulPrintLogo size={28} />
          <span className="font-condensed text-lg font-bold tracking-widest text-white uppercase">SoulPrint</span>
        </Link>
        <Link href="/" className="text-gray-400 hover:text-white text-sm flex items-center gap-2 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </nav>

      {/* Contact Form */}
      <div className="max-w-2xl mx-auto px-8 py-12">
        <div className="text-center mb-10">
          <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
            GET IN TOUCH
          </p>
          <h1 className="font-condensed font-black text-white text-3xl md:text-5xl uppercase tracking-wide mb-4">
            Contact Us
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Have a question, feedback, or just want to say hello? We'd love to hear from you.
          </p>
        </div>

        {status === 'success' ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-white text-xl font-bold mb-2">Message Sent!</h3>
            <p className="text-gray-400 text-sm mb-6">
              Thanks for reaching out. We'll get back to you as soon as possible.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="text-orange-500 hover:text-orange-400 text-sm font-medium transition-colors"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {status === 'error' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{errorMessage}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">
                Subject *
              </label>
              <input
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                placeholder="What's this about?"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">
                Message *
              </label>
              <textarea
                required
                rows={6}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
                placeholder="Tell us what's on your mind..."
              />
            </div>

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {status === 'sending' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Message
                </>
              )}
            </button>
          </form>
        )}

        {/* Additional Contact Info */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-gray-500 text-sm mb-4">
            You can also reach us directly at
          </p>
          <a 
            href="mailto:team@archeforge.com" 
            className="text-orange-500 hover:text-orange-400 font-medium transition-colors"
          >
            team@archeforge.com
          </a>
        </div>
      </div>
    </div>
  );
}
