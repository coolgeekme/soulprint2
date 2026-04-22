'use client';

// Brazilian Portuguese waitlist capture page.
// Collects email (required) + macro-region (optional) and POSTs to
// /api/waitlist/pt-br. Mobile-first. Success, error, and duplicate states
// handled inline. Copy is native pt-BR — warm and conversational.

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, Check, AlertTriangle } from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

const REGIONS = [
  { value: 'sao-paulo', label: 'São Paulo' },
  { value: 'rio-de-janeiro', label: 'Rio de Janeiro' },
  { value: 'minas-gerais', label: 'Minas Gerais' },
  { value: 'nordeste', label: 'Nordeste' },
  { value: 'sul', label: 'Sul (PR, SC, RS)' },
  { value: 'centro-oeste', label: 'Centro-Oeste' },
  { value: 'norte', label: 'Norte' },
  { value: 'prefer-not-to-say', label: 'Prefiro não dizer' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PtBrWaitlistPage() {
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successState, setSuccessState] = useState(null); // 'new' | 'existing' | null

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError('Coloca um email válido, por favor.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/waitlist/pt-br', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          region: region || undefined,
          source: 'waitlist-page',
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setError('Calma aí! Muitas tentativas. Espera um minutinho e tenta de novo.');
        setLoading(false);
        return;
      }
      if (!res.ok || !data?.success) {
        if (data?.error === 'INVALID_EMAIL') {
          setError('Esse email não parece certo. Dá uma olhadinha.');
        } else {
          setError('Deu ruim por aqui. Tenta de novo em instantes?');
        }
        setLoading(false);
        return;
      }
      setSuccessState(data.already_registered ? 'existing' : 'new');
    } catch {
      setError('Sem conexão no momento. Tenta de novo em alguns segundos?');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0D1217] text-white flex flex-col">
      {/* Simple nav */}
      <nav className="border-b border-white/5">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link href="/pt-br" className="flex items-center gap-2.5">
            <SoulPrintLogo size={28} />
            <span className="font-condensed font-bold text-lg tracking-wide uppercase">
              SoulPrint
            </span>
          </Link>
          <Link
            href="/pt-br"
            className="inline-flex items-center gap-1.5 text-xs md:text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </Link>
        </div>
      </nav>

      {/* Form card */}
      <main className="flex-1 flex items-center justify-center px-5 py-12 md:py-16 relative">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at top, rgba(246,64,0,0.2) 0%, transparent 65%)',
          }}
        />

        <div className="relative w-full max-w-md">
          {successState ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#F64000]/15 flex items-center justify-center mb-6">
                <Check className="w-8 h-8 text-[#F64000]" />
              </div>
              <h1 className="font-condensed font-black text-3xl md:text-4xl uppercase tracking-tight mb-3">
                {successState === 'existing'
                  ? 'Você já tá na lista! 🎉'
                  : 'Beleza! Você tá na lista 🎉'}
              </h1>
              <p className="text-gray-400 text-base leading-relaxed mb-8">
                {successState === 'existing'
                  ? 'A gente já tinha seu email guardado. Pode ficar tranquilo — vamos te avisar assim que o SoulPrint estiver pronto.'
                  : 'Fica de olho no seu email. A gente avisa assim que o SoulPrint estiver pronto pra você — com prioridade.'}
              </p>
              <div className="space-y-3">
                <Link
                  href="/pt-br"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/15 hover:border-white/30 hover:bg-white/5 text-gray-200 font-medium text-sm transition-all w-full"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar pro início
                </Link>
                <p className="text-xs text-gray-600">
                  Divide com quem você acha que vai curtir. A lista cresce com você.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#F64000]/30 bg-[#F64000]/10 text-[#ff7a3d] text-xs font-medium mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F64000] animate-pulse" />
                  Lista de espera • acesso prioritário
                </div>
                <h1 className="font-condensed font-black text-3xl md:text-4xl uppercase tracking-tight leading-tight mb-3">
                  Entra na lista.
                </h1>
                <p className="text-gray-400 text-base leading-relaxed">
                  A gente te avisa assim que liberar. Sem spam, prometido.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider"
                  >
                    Seu email
                  </label>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com.br"
                    className="w-full bg-black/40 border border-white/10 text-white placeholder-gray-600 text-base py-3.5 px-4 rounded-xl focus:border-[#F64000]/60 focus:outline-none focus:ring-2 focus:ring-[#F64000]/20 transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor="region"
                    className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider"
                  >
                    Sua região <span className="text-gray-600 normal-case tracking-normal">(opcional)</span>
                  </label>
                  <select
                    id="region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white text-base py-3.5 px-4 rounded-xl focus:border-[#F64000]/60 focus:outline-none focus:ring-2 focus:ring-[#F64000]/20 transition-all appearance-none"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem center',
                      paddingRight: '2.5rem',
                    }}
                  >
                    <option value="">Escolhe uma (se quiser)</option>
                    {REGIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="group w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#F64000] hover:bg-[#ff5a1f] text-white font-semibold text-sm uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#F64000]/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Quero entrar
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center leading-relaxed pt-2">
                  Ao entrar na lista, você concorda com a nossa política de
                  privacidade. Seus dados seguem a LGPD — você pode pedir pra
                  apagar a qualquer momento.
                </p>
              </form>
            </>
          )}
        </div>
      </main>

      {/* Mini footer */}
      <footer className="px-5 md:px-8 py-6 border-t border-white/5 text-center text-xs text-gray-600">
        © {new Date().getFullYear()} SoulPrint Engine • Feito com carinho para o Brasil.
      </footer>
    </div>
  );
}
