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
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p className="text-gray-300 leading-relaxed">We collect:</p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Email address (for account creation)</li>
              <li>Conversation content submitted to the Service</li>
              <li>Usage metrics (tokens, session counts, interaction timestamps)</li>
              <li>Technical metadata (IP address, browser type, device type)</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-3 font-medium">
              We do not collect unnecessary personal information.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Information</h2>
            <p className="text-gray-300 leading-relaxed">We use collected information to:</p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Provide the Service</li>
              <li>Maintain conversational continuity</li>
              <li>Improve system performance</li>
              <li>Monitor system health and cost metrics</li>
              <li>Ensure security</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-3 font-medium text-orange-400">
              We do not sell user data.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. AI Processing</h2>
            <p className="text-gray-300 leading-relaxed">
              User conversations are processed by large language model providers under contractual agreements.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              These providers may temporarily process data to generate responses but do not retain personal data 
              beyond necessary operational use, subject to their policies.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Storage</h2>
            <p className="text-gray-300 leading-relaxed">
              Conversation history and memory objects may be stored to support continuity features.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              Beta data retention policies may change as the Service evolves.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              Users may request deletion of their account and associated data.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Security</h2>
            <p className="text-gray-300 leading-relaxed">
              We implement reasonable administrative and technical safeguards to protect user data.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              No system can guarantee absolute security.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
            <p className="text-gray-300 leading-relaxed">
              We retain data as long as your account remains active or as necessary to provide the Service.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              Users may request deletion at any time.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Children's Privacy</h2>
            <p className="text-gray-300 leading-relaxed">
              SoulPrint is not intended for users under 13 years of age. Users aged 13-17 must have parental or guardian permission.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Your Rights</h2>
            <p className="text-gray-300 leading-relaxed">
              Depending on your jurisdiction, you may have rights to:
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Access your data</li>
              <li>Correct your data</li>
              <li>Delete your data</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-3">
              Contact: <a href="mailto:team@archeforge.com" className="text-orange-500 hover:text-orange-400 underline">team@archeforge.com</a>
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Privacy Policy periodically.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              Continued use of the Service constitutes acceptance of changes.
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
