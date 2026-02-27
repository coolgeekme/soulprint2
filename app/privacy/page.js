'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-sm z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button 
            onClick={() => router.back()} 
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <SoulPrintLogo size={32} />
            <span className="font-semibold">SoulPrint</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-8">
          Effective Date: March 1, 2026 • Operated by ArcheForge LLC
        </p>

        <div className="prose prose-invert prose-orange max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p className="text-gray-300 leading-relaxed">
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Email address for account creation</li>
              <li>Conversation content and messages</li>
              <li>Assessment responses and preferences</li>
              <li>Imported data from connected services (with your consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <p className="text-gray-300 leading-relaxed">
              We use your information solely to:
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Provide and personalize the SoulPrint service</li>
              <li>Remember your preferences and communication style</li>
              <li>Improve and develop new features</li>
              <li>Communicate with you about the service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Data Protection</h2>
            <p className="text-gray-300 leading-relaxed">
              Your conversations and personal data are encrypted and stored securely. 
              We do not sell your data to third parties. We do not use your conversations 
              to train AI models.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Your Rights</h2>
            <p className="text-gray-300 leading-relaxed">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Access your personal data</li>
              <li>Delete your account and all associated data</li>
              <li>Export your data</li>
              <li>Opt out of non-essential data collection</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              For privacy-related questions, please contact us at privacy@archeforge.com
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} ArcheForge LLC. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}
