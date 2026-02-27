'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function TermsOfServicePage() {
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
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-8">
          Effective Date: March 1, 2026 • Operated by ArcheForge LLC
        </p>

        <div className="prose prose-invert prose-orange max-w-none space-y-8">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              By accessing or using SoulPrint ("Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you do not agree, do not use the Service.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. User Eligibility and Accounts</h2>
            <p className="text-gray-300 leading-relaxed">
              You must be at least <span className="text-white font-semibold">13 years old</span> to use the Service. 
              If you are 13-17 years old, you must have permission from a parent or legal guardian. 
              <span className="text-orange-400 font-medium"> Users under 13 are not permitted.</span>
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              Account creation requires accurate information, including age verification where required; 
              you are responsible for maintaining confidentiality and compliance. 
              Notify us of unauthorized use immediately.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Description of Service</h2>
            <p className="text-gray-300 leading-relaxed">
              SoulPrint is an AI-powered conversational system that provides adaptive, identity-aware interaction experiences. 
              The Service may evolve over time, and features may be added, removed, or modified without prior notice.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              Beta versions may contain bugs, incomplete features, or experimental functionality.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Beta Status</h2>
            <p className="text-gray-300 leading-relaxed">
              SoulPrint may be provided in beta form.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">You acknowledge that:</p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>The Service may be unstable</li>
              <li>Data may not be permanently stored</li>
              <li>Features may change without notice</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-2">
              Beta access may be revoked at any time.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. User Content</h2>
            <p className="text-gray-300 leading-relaxed">
              You retain ownership of the content you submit ("User Content").
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              By submitting content, you grant ArcheForge LLC a limited, non-exclusive license to:
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Process</li>
              <li>Store</li>
              <li>Analyze</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-2">
              User Content solely for the purpose of operating and improving the Service.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2 font-medium">
              We do not claim ownership of your content.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. AI Output Disclaimer</h2>
            <p className="text-gray-300 leading-relaxed">
              SoulPrint generates responses using artificial intelligence.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">You acknowledge:</p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Outputs may be inaccurate</li>
              <li>Outputs may contain errors</li>
              <li>Outputs should not be relied upon as professional advice</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-2">
              The Service is provided for informational and experimental purposes only.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Prohibited Uses</h2>
            <p className="text-gray-300 leading-relaxed">You agree not to:</p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Use the Service for unlawful purposes</li>
              <li>Attempt to reverse engineer the system</li>
              <li>Circumvent usage limits</li>
              <li>Use the Service to harass, exploit, or harm others</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-2">
              We reserve the right to terminate accounts for violations.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Intellectual Property</h2>
            <p className="text-gray-300 leading-relaxed">
              All platform architecture, design, trademarks, and system features remain the exclusive property of ArcheForge LLC.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              "SoulPrint" and related marks are protected.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              You may not copy, reproduce, or create derivative systems based on the Service.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              To the maximum extent permitted by law, ArcheForge LLC shall not be liable for:
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Indirect damages</li>
              <li>Lost profits</li>
              <li>Data loss</li>
              <li>Business interruption</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-2 font-medium">
              Use of the Service is at your own risk.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Termination</h2>
            <p className="text-gray-300 leading-relaxed">
              We may suspend or terminate access at any time, with or without notice.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              Users may discontinue use at any time.
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Changes to Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update these Terms periodically. Continued use constitutes acceptance of the updated Terms.
            </p>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Governing Law</h2>
            <p className="text-gray-300 leading-relaxed">
              These Terms are governed by the laws of the State of Maryland, United States.
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
