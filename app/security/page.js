'use client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Lock, Eye, Server, Users, Trash2, Download, Brain, Zap, CheckCircle } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function SecurityPage() {
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

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-orange-500/10 to-transparent py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500/20 rounded-full mb-6">
            <Shield className="w-8 h-8 text-orange-500" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Security & Privacy</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Your trust is everything. Here's exactly how we protect your data and respect your privacy.
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-12">
          
          {/* Section 1: Data Storage */}
          <section className="bg-white/5 rounded-2xl p-8 border border-white/10">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <Server className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">How Your Data is Stored</h2>
                <p className="text-gray-400">Enterprise-grade security for your personal information</p>
              </div>
            </div>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Encrypted Database</span>
                  <p className="text-gray-400 text-sm">All data is stored in an encrypted MongoDB database with industry-standard security protocols.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Password Security</span>
                  <p className="text-gray-400 text-sm">Passwords are hashed using bcrypt — we never store or can see your actual password.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Secure Sessions</span>
                  <p className="text-gray-400 text-sm">JWT tokens with expiration ensure your sessions are secure and automatically expire.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Isolated Data</span>
                  <p className="text-gray-400 text-sm">Your memories, conversations, and profile are tied to your account only — never shared across users.</p>
                </div>
              </li>
            </ul>
          </section>

          {/* Section 2: Who Can See Your Data */}
          <section className="bg-white/5 rounded-2xl p-8 border border-white/10">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <Eye className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Who Can See Your Data</h2>
                <p className="text-gray-400">Complete transparency about data access</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">
                <h3 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> You Have Access To
                </h3>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• All your conversations</li>
                  <li>• All your stored memories</li>
                  <li>• Your profile and preferences</li>
                  <li>• Your projects and shared content</li>
                  <li>• Ability to export everything</li>
                  <li>• Ability to delete anything</li>
                </ul>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
                <h3 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
                  <Lock className="w-5 h-5" /> Admins Cannot See
                </h3>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Your conversation content</li>
                  <li>• Your stored memories</li>
                  <li>• Your personal profile details</li>
                  <li>• Your project contents</li>
                  <li>• Any identifying information in chats</li>
                </ul>
              </div>
            </div>
            <div className="mt-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
              <p className="text-orange-300 text-sm">
                <strong>What admins CAN see:</strong> Aggregate, anonymous metrics only — total users, message counts, system health. 
                This helps us improve the product without compromising your privacy.
              </p>
            </div>
          </section>

          {/* Section 3: Security Measures */}
          <section className="bg-white/5 rounded-2xl p-8 border border-white/10">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <Lock className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Security Measures</h2>
                <p className="text-gray-400">Multiple layers of protection</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { title: 'Rate Limiting', desc: 'Prevents brute force attacks and abuse' },
                { title: 'Input Sanitization', desc: 'Protects against prompt injection attacks' },
                { title: 'reCAPTCHA Verification', desc: 'Blocks bots at sign-up' },
                { title: 'Secure Token Management', desc: 'Sessions expire automatically' },
                { title: 'HTTPS Encryption', desc: 'All data encrypted in transit' },
                { title: 'Access Controls', desc: 'Role-based permissions system' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-white/5 rounded-lg">
                  <Shield className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-white font-medium">{item.title}</span>
                    <p className="text-gray-400 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3.5: Import Data Privacy */}
          <section className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl p-8 border border-green-500/20">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Trash2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Import Data Privacy</h2>
                <p className="text-gray-400">Your chat history is analyzed, not stored</p>
              </div>
            </div>
            <p className="text-gray-300 mb-4">
              When you import chat history from ChatGPT, Facebook, or other platforms:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">1</div>
                <div>
                  <span className="text-white font-medium">We extract insights</span>
                  <p className="text-gray-400 text-sm">Your messages are analyzed to understand your communication style, interests, and personality.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">2</div>
                <div>
                  <span className="text-white font-medium">We update your SoulPrint</span>
                  <p className="text-gray-400 text-sm">The AI-generated insights are added to your personalized profile.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">3</div>
                <div>
                  <span className="text-white font-medium">We delete all raw messages</span>
                  <p className="text-gray-400 text-sm">Your original messages are permanently deleted from our servers immediately after analysis.</p>
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-400 text-sm font-medium">
                ✓ Only insights and summaries are kept — never your actual conversations
              </p>
            </div>
          </section>

          {/* Section 4: Not Just ChatGPT */}
          <section className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 rounded-2xl p-8 border border-white/10">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <Brain className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">We're Not Just ChatGPT</h2>
                <p className="text-gray-400">A unified AI interface, not a wrapper</p>
              </div>
            </div>
            <p className="text-gray-300 mb-6">
              SoulPrint isn't locked to one AI provider. We're a multi-model platform that lets you choose the best AI for your needs:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { name: 'OpenAI', models: 'GPT-4o, GPT-4.5' },
                { name: 'Anthropic', models: 'Claude Sonnet' },
                { name: 'Google', models: 'Gemini 2.5 Pro' },
                { name: 'Perplexity', models: 'Research Mode' },
              ].map((provider, i) => (
                <div key={i} className="text-center p-4 bg-white/5 rounded-lg">
                  <span className="text-white font-medium block">{provider.name}</span>
                  <span className="text-gray-400 text-xs">{provider.models}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-400 text-sm">
              <strong className="text-white">Why this matters for privacy:</strong> Your data is stored on SoulPrint's servers, 
              not permanently with any AI provider. When you send a message, it's processed by your chosen AI and the response 
              is returned — but the AI providers don't retain your conversation history the way they would if you used them directly.
            </p>
          </section>

          {/* Section 5: You're In Control */}
          <section className="bg-white/5 rounded-2xl p-8 border border-white/10">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <Users className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">You're In Control</h2>
                <p className="text-gray-400">Your data, your rules</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-white/5 rounded-xl">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-500/20 rounded-full mb-4">
                  <Eye className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="font-semibold mb-2">View & Edit</h3>
                <p className="text-gray-400 text-sm">See all your stored memories and edit or remove any of them anytime.</p>
              </div>
              <div className="text-center p-6 bg-white/5 rounded-xl">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-500/20 rounded-full mb-4">
                  <Download className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="font-semibold mb-2">Export Everything</h3>
                <p className="text-gray-400 text-sm">Download all your data — conversations, memories, profile — at any time.</p>
              </div>
              <div className="text-center p-6 bg-white/5 rounded-xl">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-500/20 rounded-full mb-4">
                  <Trash2 className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="font-semibold mb-2">Delete Anytime</h3>
                <p className="text-gray-400 text-sm">Delete individual memories, conversations, or your entire account permanently.</p>
              </div>
            </div>
          </section>

          {/* Section 6: AI Processing Transparency */}
          <section className="bg-white/5 rounded-2xl p-8 border border-white/10">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-orange-500/20 rounded-xl">
                <Zap className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">AI Processing Transparency</h2>
                <p className="text-gray-400">How your messages are handled</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">1</div>
                <div>
                  <h4 className="font-medium mb-1">You Send a Message</h4>
                  <p className="text-gray-400 text-sm">Your message is encrypted and sent to SoulPrint's servers.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">2</div>
                <div>
                  <h4 className="font-medium mb-1">We Add Context</h4>
                  <p className="text-gray-400 text-sm">Your stored memories and preferences are added to give the AI context about you.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">3</div>
                <div>
                  <h4 className="font-medium mb-1">AI Processes</h4>
                  <p className="text-gray-400 text-sm">The message is sent to your chosen AI provider (OpenAI, Anthropic, etc.) for processing.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">4</div>
                <div>
                  <h4 className="font-medium mb-1">Response Stored</h4>
                  <p className="text-gray-400 text-sm">The response comes back to us, and we store it in YOUR account — not the AI provider's.</p>
                </div>
              </div>
            </div>
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-blue-300 text-sm">
                <strong>Key difference from ChatGPT:</strong> When you use ChatGPT directly, OpenAI stores your entire conversation history. 
                With SoulPrint, your history is stored with us — the AI providers only see individual requests, not your full history.
              </p>
            </div>
          </section>

          {/* Section 7: What We Don't Do */}
          <section className="bg-red-500/5 rounded-2xl p-8 border border-red-500/20">
            <h2 className="text-2xl font-semibold mb-6 text-center">What We Don't Do</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                'Sell your data to third parties',
                'Show ads based on your conversations',
                'Share your personal information',
                'Train AI models on your private data',
                'Store your data longer than necessary',
                'Access your conversations without permission',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                  <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-red-400 text-lg">×</span>
                  </div>
                  <span className="text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Contact */}
          <section className="text-center py-8">
            <h2 className="text-xl font-semibold mb-4">Questions or Concerns?</h2>
            <p className="text-gray-400 mb-6">
              We're committed to transparency. If you have any questions about how your data is handled, 
              please reach out.
            </p>
            <a 
              href="mailto:team@archeforge.com" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
            >
              Contact Us
            </a>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} ArcheForge LLC. All rights reserved.
          </p>
          <div className="flex justify-center gap-6 mt-4">
            <a href="/privacy" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">Privacy Policy</a>
            <a href="/terms" className="text-gray-400 hover:text-orange-500 text-sm transition-colors">Terms of Service</a>
          </div>
        </div>
      </main>
    </div>
  );
}
