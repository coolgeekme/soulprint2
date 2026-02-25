'use client';
import { useState, useEffect } from 'react';
import { X, Download, Smartphone, Monitor, Sparkles } from 'lucide-react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Show again after 7 days
    if (standalone || (dismissed && daysSinceDismissed < 7)) {
      return;
    }

    // Listen for the beforeinstallprompt event (Chrome, Edge, etc.)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after a short delay (let user settle in first)
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // For iOS, show the prompt after delay since there's no beforeinstallprompt
    if (iOS && !standalone) {
      setTimeout(() => setShowPrompt(true), 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  const handleRemindLater = () => {
    // Dismiss for 1 day
    localStorage.setItem('pwa-install-dismissed', (Date.now() - 6 * 24 * 60 * 60 * 1000).toString());
    setShowPrompt(false);
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header with gradient */}
        <div className="relative px-6 pt-6 pb-4">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors text-gray-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Install SoulPrint</h3>
              <p className="text-sm text-gray-400">Get the full app experience</p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="px-6 pb-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Monitor className="w-4 h-4 text-orange-400" />
              </div>
              <span>Launch instantly from your desktop or home screen</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-4 h-4 text-orange-400" />
              </div>
              <span>Works offline and loads faster</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-orange-400" />
              </div>
              <span>Full-screen experience without browser UI</span>
            </div>
          </div>
        </div>

        {/* iOS-specific instructions */}
        {isIOS && (
          <div className="mx-6 mb-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-300 font-medium mb-2">📱 To install on iOS:</p>
            <ol className="text-xs text-blue-200/80 space-y-1 list-decimal list-inside">
              <li>Tap the <strong>Share</strong> button in Safari</li>
              <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
              <li>Tap <strong>"Add"</strong> to confirm</li>
            </ol>
          </div>
        )}

        {/* Action buttons */}
        <div className="px-6 pb-6 space-y-3">
          {!isIOS && deferredPrompt ? (
            <button
              onClick={handleInstall}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
            >
              <Download className="w-5 h-5" />
              Install App
            </button>
          ) : (
            <button
              onClick={handleDismiss}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
            >
              Got it!
            </button>
          )}
          <button
            onClick={handleRemindLater}
            className="w-full py-2.5 px-4 text-gray-400 text-sm hover:text-white transition-colors"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}
