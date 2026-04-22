'use client';

// Main Brazilian Portuguese marketing page for SoulPrint Engine.
// All user-facing copy is written natively in pt-BR (warm, hybrid premium +
// conversational tone). Code, comments, and variable names remain in
// English per product decision. Mobile-first layout; Brazil is overwhelmingly
// mobile-heavy.

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Brain,
  Mic,
  Sparkles,
  ShieldCheck,
  MapPin,
  Globe,
  ChevronDown,
  Check,
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1571454441103-39766107ff06?auto=format&fit=crop&w=1600&q=80';

const FEATURES = [
  {
    icon: Brain,
    title: 'Memória que funciona',
    body:
      'Ele lembra do que importa pra você. Projetos, pessoas, preferências. Sem precisar repetir toda conversa.',
  },
  {
    icon: Mic,
    title: 'Voz em português brasileiro',
    body:
      'Fala com o sotaque daqui. Entende “massa”, “show”, “uai”, “oxe”. Não soa traduzido do inglês.',
  },
  {
    icon: Sparkles,
    title: 'Imagens e vídeos na conversa',
    body:
      'Descreve o que você quer. O SoulPrint gera na hora — direto no chat, sem sair pra outro app.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacidade LGPD em primeiro lugar',
    body:
      'Seus dados são seus. Modo anônimo, exportação e exclusão garantidas. Nada de letrinha miúda.',
  },
  {
    icon: MapPin,
    title: 'Se adapta à sua região',
    body:
      'Paulista, carioca, nordestino, gaúcho ou mineiro? Ele pega o jeitinho de cada lugar e conversa no seu tom.',
  },
  {
    icon: Globe,
    title: 'Busca na web em tempo real',
    body:
      'Não é IA presa no passado. Ele pesquisa, compara e cita fontes pra você não ficar no escuro.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Entra na lista',
    body:
      'Seu email e sua região (se quiser). Quem entra agora tem prioridade no acesso — e fica sabendo antes de todo mundo.',
  },
  {
    n: '02',
    title: 'Monta seu SoulPrint',
    body:
      'Umas perguntinhas descontraídas pra ele te entender. Pode pular — ele também aprende conversando, no seu ritmo.',
  },
  {
    n: '03',
    title: 'Conversa à vontade',
    body:
      'Texto, voz, imagens, vídeos. Cada conversa afina mais a IA pra você. Seu jeito vira o jeito dela.',
  },
];

const FAQ = [
  {
    q: 'Quando abre pro público?',
    a: 'Tamo nos últimos ajustes. Quem entra agora na lista tem prioridade no acesso — e a gente avisa primeiro, antes de todo mundo.',
  },
  {
    q: 'É pago?',
    a: 'Vai ter plano gratuito pra todo mundo usar. O plano premium vem com PIX, claro. Quem tá na lista ganha desconto no lançamento.',
  },
  {
    q: 'Meus dados estão seguros?',
    a: 'Seguimos a LGPD desde o primeiro dia. Você pode exportar ou apagar tudo quando quiser. Modo anônimo disponível a qualquer momento — suas conversão sigilosas continuam sigilosas.',
  },
  {
    q: 'Funciona no celular?',
    a: 'Funciona, e foi pensado pro celular primeiro. Dá pra instalar como app (PWA) — fica com cara de aplicativo nativo, sem precisar baixar da loja.',
  },
  {
    q: 'Qual a diferença pro ChatGPT?',
    a: 'O ChatGPT é incrível, mas não te conhece. Toda conversa começa do zero. O SoulPrint vai aprendendo seu jeito, seu contexto, seu tom. E fala português brasileiro de verdade — não traduzido do inglês, não “português de Portugal com açúcar”.',
  },
];

export default function PtBrMainPage() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="min-h-screen bg-[#0D1217] text-white overflow-x-hidden">
      {/* ------------------------------------------------------------ NAV */}
      <nav className="sticky top-0 z-40 backdrop-blur-md bg-[#0D1217]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link href="/pt-br" className="flex items-center gap-2.5">
            <SoulPrintLogo size={28} />
            <span className="font-condensed font-bold text-lg tracking-wide uppercase">
              SoulPrint
            </span>
          </Link>
          <Link
            href="/pt-br/waitlist"
            className="text-xs md:text-sm font-semibold px-4 py-2 rounded-full bg-[#F64000] hover:bg-[#ff5a1f] transition-colors uppercase tracking-wider"
          >
            Entrar na lista
          </Link>
        </div>
      </nav>

      {/* ---------------------------------------------------------- HERO */}
      <section className="relative pt-12 md:pt-20 pb-16 md:pb-28 px-5 md:px-8">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at top, rgba(246,64,0,0.22) 0%, transparent 65%)',
          }}
        />
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#F64000]/30 bg-[#F64000]/10 text-[#ff7a3d] text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F64000] animate-pulse" />
            Em breve • Primeiro para o Brasil
          </div>

          <h1 className="font-condensed font-black text-4xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight uppercase">
            Uma IA que te conhece
            <br />
            <span className="text-[#F64000]">de verdade.</span>
          </h1>

          <p className="mt-6 text-base md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Pare de reexplicar sua vida toda conversa. O SoulPrint aprende seu
            jeito, seu tom, seu contexto. Quanto mais vocês conversam, mais ele
            te entende.
          </p>

          <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/pt-br/waitlist"
              className="w-full sm:w-auto group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-[#F64000] hover:bg-[#ff5a1f] text-white font-semibold text-sm uppercase tracking-widest transition-all shadow-lg shadow-[#F64000]/20"
            >
              Entrar na lista de espera
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#como-funciona"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full border border-white/15 hover:border-white/30 hover:bg-white/5 text-gray-200 font-medium text-sm transition-all"
            >
              Ver como funciona
              <ChevronDown className="w-4 h-4" />
            </a>
          </div>

          <p className="mt-5 text-xs text-gray-500">
            Sem spam. Sem compromisso. Você sai quando quiser.
          </p>
        </div>

        {/* Hero visual */}
        <div className="relative max-w-4xl mx-auto mt-14 md:mt-20">
          <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
            <img
              src={HERO_IMAGE}
              alt="Luz quente abstrata em tons de âmbar simbolizando calor e inteligência"
              className="w-full h-[280px] md:h-[460px] object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D1217] via-[#0D1217]/20 to-transparent" />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- O QUE É */}
      <section className="px-5 md:px-8 py-16 md:py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-xs uppercase tracking-[0.3em] text-[#F64000] mb-4 text-center">
            O problema
          </div>
          <h2 className="font-condensed font-black text-3xl md:text-5xl uppercase tracking-tight text-center leading-tight">
            Toda IA é amnésica.
            <br />
            <span className="text-[#F64000]">O SoulPrint não.</span>
          </h2>
          <div className="mt-8 text-base md:text-lg text-gray-300 leading-relaxed space-y-5 text-center max-w-3xl mx-auto">
            <p>
              Hoje você conta sua vida pra uma IA, ela responde bem, e quando
              você abre uma nova conversa — puf, começou do zero. De novo. E de
              novo.
            </p>
            <p>
              O SoulPrint é diferente. A cada conversa, ele vai construindo um
              perfil seu — o seu{' '}
              <span className="text-white font-semibold">SoulPrint</span>. Seu
              jeito de falar, seus projetos, suas referências, seus valores.
            </p>
            <p className="text-white">
              Não é prompt engineering. É memória de verdade.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ FEATURES */}
      <section className="px-5 md:px-8 py-16 md:py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <div className="text-xs uppercase tracking-[0.3em] text-[#F64000] mb-4">
              O que ele faz
            </div>
            <h2 className="font-condensed font-black text-3xl md:text-5xl uppercase tracking-tight leading-tight">
              Uma IA feita pro Brasil,
              <br />
              <span className="text-[#F64000]">não traduzida.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group p-6 md:p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#F64000]/30 hover:bg-white/[0.05] transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#F64000]/15 flex items-center justify-center mb-4 group-hover:bg-[#F64000]/25 transition-colors">
                    <Icon className="w-5 h-5 text-[#F64000]" />
                  </div>
                  <h3 className="font-semibold text-lg text-white mb-2">
                    {f.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {f.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- COMO FUNCIONA */}
      <section id="como-funciona" className="px-5 md:px-8 py-16 md:py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <div className="text-xs uppercase tracking-[0.3em] text-[#F64000] mb-4">
              Como funciona
            </div>
            <h2 className="font-condensed font-black text-3xl md:text-5xl uppercase tracking-tight leading-tight">
              Três passos.
              <br />
              <span className="text-[#F64000]">Sem enrolação.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="relative p-7 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10"
              >
                <div className="font-condensed font-black text-5xl text-[#F64000]/40 mb-3">
                  {s.n}
                </div>
                <h3 className="font-semibold text-xl text-white mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ FAQ */}
      <section className="px-5 md:px-8 py-16 md:py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10 md:mb-14">
            <div className="text-xs uppercase tracking-[0.3em] text-[#F64000] mb-4">
              Perguntas que todo mundo faz
            </div>
            <h2 className="font-condensed font-black text-3xl md:text-5xl uppercase tracking-tight leading-tight">
              Resposta rápida,
              <br />
              <span className="text-[#F64000]">sem enrolação.</span>
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    className="w-full flex items-center justify-between gap-4 p-5 md:p-6 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="font-semibold text-sm md:text-base text-white">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#F64000] flex-shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 md:px-6 pb-5 md:pb-6 text-sm md:text-base text-gray-400 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- FINAL CTA */}
      <section className="px-5 md:px-8 py-20 md:py-28 border-t border-white/5 relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(246,64,0,0.15) 0%, transparent 60%)',
          }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="font-condensed font-black text-3xl md:text-5xl uppercase tracking-tight leading-tight">
            Cansou de começar
            <br />
            <span className="text-[#F64000]">do zero toda vez?</span>
          </h2>
          <p className="mt-5 text-base md:text-lg text-gray-300 max-w-xl mx-auto">
            Entra na lista agora. A gente avisa assim que liberar acesso — com
            prioridade pra quem se cadastrar primeiro.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/pt-br/waitlist"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#F64000] hover:bg-[#ff5a1f] text-white font-semibold text-sm uppercase tracking-widest transition-all shadow-xl shadow-[#F64000]/30"
            >
              Entrar na lista de espera
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#F64000]" /> Sem spam
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#F64000]" /> LGPD compliant
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#F64000]" /> Você sai quando quiser
            </span>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- FOOTER */}
      <footer className="px-5 md:px-8 py-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2.5">
            <SoulPrintLogo size={22} />
            <span className="font-condensed font-bold uppercase tracking-wider text-gray-300">
              SoulPrint Engine
            </span>
          </div>
          <div className="text-xs text-center md:text-right">
            © {new Date().getFullYear()} SoulPrint Engine • Feito com carinho
            para o Brasil.
          </div>
        </div>
      </footer>
    </div>
  );
}
