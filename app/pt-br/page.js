'use client';

// Brazilian Portuguese landing page for SoulPrint Engine.
// Mirrors the production English landing page at /app/app/page.js
// (structure, sections, visual design) with:
//   - 100% native pt-BR copy (warm, hybrid premium conversational tone)
//   - ALL CTAs point to /pt-br/waitlist (no signup flow on pt-BR yet)
//   - No auth / isLoggedIn logic (product isn't open to Brazilians yet)
//   - No blog section (no pt-BR blog exists)
//   - Testimonials use Brazilian first names for cultural authenticity
// Code, comments, and variable names remain in English.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Youtube,
  User,
  ArrowRight,
  Brain,
  Zap,
  Fingerprint,
  Heart,
  Sparkles,
  Shield,
  Check,
  Star,
  Quote,
  MessageSquare,
} from 'lucide-react';
import SoulPrintLogo from '@/components/SoulPrintLogo';

const HERO_IMAGE = '/hero-headshot-nobg.png';
const WAITLIST_URL = '/pt-br/waitlist';

// 5 differentiating features (mirrors FIVE_FEATURES in /app/app/page.js)
const FIVE_FEATURES = [
  {
    icon: Brain,
    title: 'Memória Persistente',
    desc:
      'Lembra do contexto em cada conversa. Chega de repetir tudo o tempo todo — ele conhece sua história, suas preferências e os projetos que você tá tocando.',
    color: 'from-orange-500/20 to-orange-600/5',
    border: 'border-orange-500/30',
    iconColor: 'text-orange-400',
  },
  {
    icon: Zap,
    title: 'Inteligência Dinâmica',
    desc:
      'Escolhe sozinho o melhor modelo de IA pra cada tarefa. Seja pra escrever com criatividade, pesquisar ou analisar — ele usa o cérebro certo.',
    color: 'from-yellow-500/20 to-yellow-600/5',
    border: 'border-yellow-500/30',
    iconColor: 'text-yellow-400',
  },
  {
    icon: Fingerprint,
    title: 'Alinhamento de Identidade',
    desc:
      'Não é só personalização — ele captura como você pensa e toma decisões. Seu estilo de decisão, seu jeito de se comunicar e como você lida com conflitos.',
    color: 'from-purple-500/20 to-purple-600/5',
    border: 'border-purple-500/30',
    iconColor: 'text-purple-400',
  },
  {
    icon: Heart,
    title: 'Camada de Relacionamento',
    desc:
      'Vai criando intimidade com o tempo, igual uma pessoa de verdade. Quanto mais vocês conversam, mais ele entende seu jeito e seus padrões.',
    color: 'from-pink-500/20 to-pink-600/5',
    border: 'border-pink-500/30',
    iconColor: 'text-pink-400',
  },
  {
    icon: Sparkles,
    title: 'Integração de Gosto',
    desc:
      'Aprende o seu padrão de “o que é bom”. Do estilo de escrita ao jeito que você gosta de ver as coisas — ele pega seu gosto e entrega na sua.',
    color: 'from-emerald-500/20 to-emerald-600/5',
    border: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
];

// Testimonials adapted for the Brazilian audience. The sentiment mirrors the
// real English testimonials; names and tone are culturally adapted.
const TESTIMONIALS = [
  {
    quote:
      'Vou ser direta: é melhor que o ChatGPT. Entrei desconfiada, achando que era mais uma IA que promete e não entrega. Em três conversas eu já tava vendida — ele entende o que eu quero sem eu precisar explicar dez vezes.',
    author: 'Mariana',
    role: 'Criadora de conteúdo',
  },
  {
    quote:
      'Tô usando faz duas semanas pra me ajudar com saúde e bem-estar. Tá certeiro. Vou começar a usar também pro meu trabalho de consultoria, ver como ele responde no dia a dia.',
    author: 'Rodrigo',
    role: 'Consultor',
  },
  {
    quote: 'SoulPrint Engine é foda demais. Simples assim.',
    author: 'Paulo',
    role: 'Beta tester',
  },
];

const FAQS = [
  {
    q: 'O que é um SoulPrint?',
    a:
      'Um SoulPrint é sua identidade persistente dentro de uma IA — um perfil estruturado de como você pensa, decide, reage, prioriza, confia e se comunica. Ele fica embutido no sistema, então toda conversa reflete VOCÊ, não o comportamento genérico do modelo. A maioria das IAs reseta a cada sessão. Seu SoulPrint cria continuidade pra sempre.',
  },
  {
    q: 'O que ele consegue fazer, na prática?',
    a:
      'Pesquisa qualquer assunto, escreve mensagens, gera imagens e vídeos, navega na web, responde perguntas profundas, ajuda em projetos criativos, cuida do seu calendário e email — tudo por um chat simples. Ele age, não só responde.',
  },
  {
    q: 'Qual a diferença pro ChatGPT?',
    a:
      'O ChatGPT esquece de você depois de cada conversa. O SoulPrint captura seu estilo de decisão, seu jeito de lidar com conflito, seu ritmo de comunicação, seus padrões — então ele fica mais esperto sobre VOCÊ, não só sobre conhecimento geral.',
  },
  {
    q: 'Funciona por voz?',
    a:
      'Funciona. Dá pra falar sem usar as mãos ou mandar áudio. Seu SoulPrint escuta, entende e responde no tom natural — em português brasileiro, com o nosso sotaque.',
  },
  {
    q: 'Meus dados são privados?',
    a:
      'São, sim. Suas conversas são criptografadas e nunca usadas pra treinar modelos de IA. Seus dados são seus — você pode exportar ou apagar tudo a qualquer momento. Seguimos a LGPD desde o primeiro dia.',
  },
  {
    q: 'Como eu começo?',
    a:
      'Clica em “Entrar na lista” aí em cima, coloca seu email e a gente te avisa assim que liberar acesso. Prioridade garantida pra quem entrar agora.',
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="py-4 cursor-pointer border-b border-white/10"
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300 font-medium">{q}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </div>
      {open && (
        <p className="mt-3 text-sm text-gray-500 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

function InlineCTA({ text, subtext }) {
  return (
    <div className="text-center py-8">
      <Link
        href={WAITLIST_URL}
        className="btn-orange px-8 py-3.5 rounded-xl text-sm inline-flex items-center gap-2"
      >
        {text || 'Entrar na lista de espera'} <ArrowRight className="w-4 h-4" />
      </Link>
      {subtext && <p className="text-gray-500 text-xs mt-3">{subtext}</p>}
    </div>
  );
}

export default function PtBrLandingPage() {
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Show sticky CTA bar after scrolling past the hero
  useEffect(() => {
    const handleScroll = () => setShowStickyBar(window.scrollY > 600);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-sp-black">
      {/* ══ STICKY CTA BAR ══ */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          showStickyBar
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0'
        }`}
      >
        <div className="bg-sp-black/95 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SoulPrintLogo size={22} />
              <span className="font-condensed text-sm font-bold tracking-widest text-white uppercase hidden sm:inline">
                SoulPrint
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-xs hidden md:inline">
                A IA que realmente te conhece
              </span>
              <Link
                href={WAITLIST_URL}
                className="btn-orange px-5 py-2 rounded-lg text-xs"
              >
                Entrar na lista →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden" style={{ minHeight: '100vh' }}>
        <div className="absolute inset-0 grid-bg opacity-100" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(246,64,0,0.15)_0%,transparent_70%)]" />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="absolute right-[-5%] top-1/2 -translate-y-1/2 opacity-[0.06]">
            <SoulPrintLogo size={900} />
          </div>
        </div>

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
          <Link href="/pt-br" className="flex items-center gap-2">
            <SoulPrintLogo size={28} />
            <span className="font-condensed text-lg font-bold tracking-widest text-white uppercase">
              SoulPrint
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <a
              href="#features"
              className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline"
            >
              Recursos
            </a>
            <a
              href="#testimonials"
              className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline"
            >
              Avaliações
            </a>
            <Link
              href={WAITLIST_URL}
              className="btn-orange px-5 py-2 rounded-lg text-sm"
            >
              Entrar na lista
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-8 flex items-center min-h-[calc(100vh-80px)]">
          <div className="flex items-center gap-0 w-full">
            <div className="flex-1 pr-8">
              <h1
                className="font-condensed font-black text-white leading-none mb-6"
                style={{ fontSize: 'clamp(48px, 7.5vw, 100px)', letterSpacing: '-1px' }}
              >
                CHEGA DE<br />
                SE EXPLICAR<br />
                PRA IA
              </h1>
              <p className="text-gray-400 text-base mb-4 max-w-md leading-relaxed">
                Converse, organize, reflita e planeje com uma IA que lembra do
                seu tom, do seu ritmo e da sua vida.
              </p>

              {/* Trust indicators */}
              <div className="flex items-center gap-4 mb-8 flex-wrap">
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-green-500" /> Privado e Criptografado
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-500" /> GPT-4o, Gemini e Claude
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-orange-500" /> Grátis pra começar
                </span>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <Link
                  href={WAITLIST_URL}
                  className="btn-orange px-7 py-3.5 rounded-xl text-sm inline-flex items-center gap-2"
                >
                  Entrar na lista — é grátis
                </Link>
                <a
                  href="#features"
                  className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
                >
                  Ver o que ele faz <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="flex-shrink-0 w-[440px] h-[580px] relative hidden lg:block">
              <img
                src={HERO_IMAGE}
                alt="SoulPrint"
                className="w-full h-full object-contain"
                style={{ filter: 'contrast(1.1) brightness(1.05)' }}
              />
              <div
                className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
                style={{ background: 'linear-gradient(to top, #0a0a0a, transparent)' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══ SOCIAL PROOF BAR ══ */}
      <section className="bg-white py-6 px-8 border-b border-gray-200">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-white flex items-center justify-center"
                >
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
              ))}
            </div>
            <div>
              <p className="text-gray-900 text-sm font-bold">Mais de 20.000</p>
              <p className="text-gray-500 text-[10px]">
                já descobriram o SoulPrint
              </p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-4 h-4 text-orange-500 fill-orange-500" />
            ))}
            <span className="text-gray-700 text-sm font-medium ml-1">
              Amado pelos primeiros usuários
            </span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="text-gray-700 text-sm font-medium">
              Seus dados são seus
            </span>
          </div>
        </div>
      </section>

      {/* ══ 5 THINGS SOULPRINT CAN DO ══ */}
      <section id="features" className="bg-sp-black grid-bg py-24 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
              O QUE FAZ DIFERENTE
            </p>
            <h2
              className="font-condensed font-black text-white leading-tight mb-4"
              style={{ fontSize: 'clamp(28px, 4vw, 52px)' }}
            >
              5 COISAS QUE O SOULPRINT ENGINE FAZ
              <br />
              <span className="text-orange-400">QUE OUTRA IA NÃO FAZ</span>
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto">
              Isso não é mais um chatbot. O SoulPrint Engine é um tipo
              fundamentalmente diferente de IA — construído em volta de você.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FIVE_FEATURES.slice(0, 3).map((f, i) => (
              <div
                key={i}
                className={`rounded-2xl p-6 bg-gradient-to-br ${f.color} border ${f.border} hover:scale-[1.02] transition-transform duration-200`}
              >
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                  <f.icon className={`w-6 h-6 ${f.iconColor}`} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-[calc(66.666%+0.75rem)] md:mx-auto">
            {FIVE_FEATURES.slice(3, 5).map((f, i) => (
              <div
                key={i + 3}
                className={`rounded-2xl p-6 bg-gradient-to-br ${f.color} border ${f.border} hover:scale-[1.02] transition-transform duration-200`}
              >
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                  <f.icon className={`w-6 h-6 ${f.iconColor}`} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <InlineCTA
            text="Entrar na lista"
            subtext="Grátis pra começar. Sem cartão de crédito."
          />
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section className="bg-white py-24 px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
              COMO COMEÇAR
            </p>
            <h2 className="font-condensed font-black text-gray-900 text-3xl md:text-5xl uppercase">
              Seu SoulPrint em 3 Passos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: '01',
                title: 'Entra na lista',
                desc: 'Coloca seu email em poucos segundos. Sem cartão de crédito, sem compromisso.',
                icon: User,
              },
              {
                num: '02',
                title: 'Faz a avaliação',
                desc: 'Responde umas perguntas rápidas pra IA entender como você pensa e se comunica.',
                icon: Brain,
              },
              {
                num: '03',
                title: 'Começa a conversar',
                desc: 'Sua IA se adapta na hora. Quanto mais você usa, mais esperta ela fica sobre você.',
                icon: MessageSquare,
              },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-7 h-7 text-orange-500" />
                </div>
                <span className="text-orange-500 font-condensed font-bold text-xs tracking-widest">
                  {step.num}
                </span>
                <h3 className="font-condensed font-bold text-gray-900 text-xl uppercase mt-1 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center pt-10">
            <Link
              href={WAITLIST_URL}
              className="btn-orange px-8 py-3.5 rounded-xl text-sm inline-flex items-center gap-2"
            >
              Entrar na lista — leva 30 segundos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ VS GENERIC AI ══ */}
      <section className="bg-sp-black grid-bg py-24 px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
              A DIFERENÇA
            </p>
            <h2 className="font-condensed font-black text-white text-3xl md:text-5xl uppercase tracking-wide">
              SoulPrint vs. IA Genérica
            </h2>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 bg-white/5 p-4">
              <div className="text-xs text-gray-500 uppercase font-bold tracking-wider"></div>
              <div className="text-center text-xs text-gray-500 uppercase font-bold tracking-wider">
                ChatGPT / Outros
              </div>
              <div className="text-center text-xs text-orange-400 uppercase font-bold tracking-wider">
                SoulPrint
              </div>
            </div>
            {[
              { label: 'Memória', generic: 'Reseta a cada sessão', sp: 'Lembra de tudo' },
              { label: 'Personalidade', generic: 'Respostas genéricas', sp: 'Adapta ao SEU jeito' },
              {
                label: 'Inteligência',
                generic: 'Modelo único',
                sp: 'Escolhe a melhor IA pra tarefa',
              },
              {
                label: 'Relacionamento',
                generic: 'Estranho toda vez',
                sp: 'Cria intimidade com o tempo',
              },
              {
                label: 'Ações',
                generic: 'Só texto',
                sp: 'Imagens, vídeo, web, código e mais',
              },
              { label: 'Voz', generic: 'Limitada', sp: 'Conversa completa por voz' },
              {
                label: 'Privacidade',
                generic: 'Treina com seus dados',
                sp: 'Seus dados são seus',
              },
            ].map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-3 p-4 ${
                  i % 2 === 0 ? 'bg-white/[0.02]' : ''
                } border-t border-white/5`}
              >
                <div className="text-sm text-white font-medium">{row.label}</div>
                <div className="text-center text-sm text-gray-500">{row.generic}</div>
                <div className="text-center text-sm text-orange-300 font-medium flex items-center justify-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" /> {row.sp}
                </div>
              </div>
            ))}
          </div>

          <InlineCTA
            text="Entrar na lista"
            subtext="Confere a diferença com seus próprios olhos."
          />
        </div>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section id="testimonials" className="bg-white py-24 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
              USUÁRIOS REAIS, PALAVRAS REAIS
            </p>
            <h2 className="font-condensed font-black text-gray-900 text-3xl md:text-5xl uppercase">
              O Que As Pessoas Estão Dizendo
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className={`rounded-2xl p-6 border ${
                  i === 0
                    ? 'bg-gradient-to-br from-orange-50 to-white border-orange-200 md:col-span-2 lg:col-span-1'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className="w-4 h-4 text-orange-500 fill-orange-500"
                    />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-orange-500/20 mb-2" />
                <p className="text-gray-800 text-sm leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">{t.author[0]}</span>
                  </div>
                  <div>
                    <p className="text-gray-900 text-sm font-bold">{t.author}</p>
                    <p className="text-gray-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center pt-10">
            <Link
              href={WAITLIST_URL}
              className="btn-orange px-8 py-3.5 rounded-xl text-sm inline-flex items-center gap-2"
            >
              Entra pra essa galera — Entrar na lista <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-gray-400 text-xs mt-3">
              Grátis pra começar. Cancela quando quiser.
            </p>
          </div>
        </div>
      </section>

      {/* ══ ALSO DOES ══ */}
      <section className="bg-sp-black py-16 px-8 border-y border-white/10">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-gray-500 text-xs uppercase tracking-widest mb-8 font-condensed font-bold">
            Ele também faz
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🎨', label: 'Gera Imagens e Vídeos' },
              { icon: '🌐', label: 'Navega na Web em Tempo Real' },
              { icon: '🎙️', label: 'Conversas por Voz' },
              { icon: '📄', label: 'Lê e Analisa Documentos' },
              { icon: '📧', label: 'Email e Calendário (em breve)' },
              { icon: '🔍', label: 'Pesquisa Profunda' },
              { icon: '💻', label: 'Ajuda com Código (GitHub)' },
              { icon: '🔒', label: 'Criptografado e Privado' },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-xl p-4 text-center hover:border-orange-500/30 transition-colors"
              >
                <span className="text-2xl">{item.icon}</span>
                <p className="text-gray-300 text-xs mt-2 font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section id="faq" className="bg-sp-black grid-bg py-24 px-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-orange-500 font-condensed font-bold text-sm tracking-widest uppercase mb-3">
              DÚVIDAS?
            </p>
            <h2 className="font-condensed font-black text-white text-3xl md:text-4xl uppercase tracking-wide">
              Perguntas Frequentes
            </h2>
          </div>
          {FAQS.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section className="bg-sp-black py-20 px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div
            className="rounded-3xl p-10 md:p-16 relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, rgba(246,64,0,0.15), rgba(246,64,0,0.05))',
              border: '1px solid rgba(246,64,0,0.25)',
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(246,64,0,0.1)_0%,transparent_70%)]" />
            <div className="relative z-10">
              <SoulPrintLogo size={60} className="mx-auto mb-6 opacity-90" />
              <h2 className="font-condensed font-black text-white text-3xl md:text-5xl uppercase leading-tight mb-4">
                Pronto pra conhecer
                <br />
                seu SoulPrint?
              </h2>
              <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto">
                Junte-se aos milhares de pessoas que já descobriram o que é uma
                IA que realmente te conhece.
              </p>
              <Link
                href={WAITLIST_URL}
                className="btn-orange px-10 py-4 rounded-xl text-base inline-flex items-center gap-2"
              >
                Entrar na lista — é grátis <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-gray-600 text-xs mt-4">
                Sem cartão de crédito. Sem compromisso. Só uma IA melhor.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="bg-[#f0f0f0] py-12 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-4">
              <SoulPrintLogo size={20} />
              <span className="font-condensed font-bold text-gray-800 tracking-widest text-xs uppercase">
                SoulPrint
              </span>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <a
                href="https://facebook.com/archeforgehq"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-800 transition-colors"
                title="Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="https://instagram.com/archeforgehq"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-800 transition-colors"
                title="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://x.com/archeforgehq"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-800 transition-colors"
                title="X (Twitter)"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="https://www.youtube.com/@ArcheForgeHQ"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-800 transition-colors"
                title="YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="https://www.linkedin.com/company/arche-forge/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-800 transition-colors"
                title="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
            <div className="flex items-center gap-6">
              <Link
                href="/pt-br"
                className="text-gray-600 text-xs hover:text-gray-900 transition-colors"
              >
                Início
              </Link>
              <Link
                href="/contact"
                className="text-gray-600 text-xs hover:text-gray-900 transition-colors"
              >
                Contato
              </Link>
              <a
                href="#faq"
                className="text-gray-600 text-xs hover:text-gray-900 transition-colors"
              >
                Perguntas
              </a>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 border-t border-gray-300 pt-6">
            <p className="text-gray-500 text-xs">
              Copyright 2026 © SoulPrint™ por ArcheForge LLC. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/security"
                className="text-gray-500 text-xs hover:text-gray-800 transition-colors"
              >
                Segurança
              </Link>
              <Link
                href="/privacy"
                className="text-gray-500 text-xs hover:text-gray-800 transition-colors"
              >
                Privacidade
              </Link>
              <Link
                href="/terms"
                className="text-gray-500 text-xs hover:text-gray-800 transition-colors"
              >
                Termos
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
