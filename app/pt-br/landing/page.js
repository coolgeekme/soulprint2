'use client'

import Link from 'next/link'
import { ArrowRight, Shield, Zap, Users, CheckCircle, Sparkles } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Minimal Header */}
      <header className="fixed top-0 w-full bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-6 w-6 text-orange-500" />
            <span className="text-xl font-bold text-white">SOULPRINT</span>
          </div>
          <Link 
            href="/pt-br/waitlist"
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-semibold transition-all"
          >
            Entrar na Lista
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          {/* Announcement Badge */}
          <div className="inline-flex items-center space-x-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-2 mb-8">
            <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse"></div>
            <span className="text-orange-400 text-sm font-medium">Em breve no Brasil</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Uma IA que <span className="text-orange-500">entende você</span> de verdade
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Pare de se explicar. Converse com uma inteligência artificial que se adapta ao seu tom, ritmo e estilo de vida.
          </p>

          {/* Primary CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link 
              href="/pt-br/waitlist"
              className="group bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-all flex items-center space-x-2 shadow-lg hover:shadow-orange-500/50"
            >
              <span>Garantir Meu Acesso — Grátis</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>100% Grátis para começar</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Sem cartão de crédito</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Cancele quando quiser</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-gray-800/50">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
            Por que o SoulPrint é diferente?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-8 hover:border-orange-500/50 transition-all">
              <div className="bg-orange-500/10 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Privado e Criptografado</h3>
              <p className="text-gray-400">
                Suas conversas são 100% privadas. Usamos criptografia de ponta a ponta para proteger seus dados.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-8 hover:border-orange-500/50 transition-all">
              <div className="bg-orange-500/10 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">IA de Última Geração</h3>
              <p className="text-gray-400">
                Powered by GPT-4o, Gemini e Claude. A melhor tecnologia de IA disponível no mercado.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-8 hover:border-orange-500/50 transition-all">
              <div className="bg-orange-500/10 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Feito para Você</h3>
              <p className="text-gray-400">
                Se adapta ao seu jeito de falar, seus objetivos e sua rotina. Uma IA que realmente te entende.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Chega de repetir as mesmas coisas
              </h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-white font-semibold mb-1">Memória Personalizada</h3>
                    <p className="text-gray-400">A IA lembra de você, suas preferências e contexto das conversas anteriores.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-white font-semibold mb-1">Organize Sua Vida</h3>
                    <p className="text-gray-400">Planeje projetos, organize ideias e gerencie tarefas de forma natural.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-white font-semibold mb-1">Tom Autêntico</h3>
                    <p className="text-gray-400">Converse do seu jeito. A IA se adapta ao seu ritmo e estilo de comunicação.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500/20 to-purple-500/20 rounded-2xl p-8 border border-orange-500/30">
              <div className="bg-gray-900 rounded-lg p-6 space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-orange-500 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                    V
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-300 text-sm">
                      "Preciso organizar o lançamento do meu produto na próxima semana"
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-purple-500 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">
                      Entendi! Vou criar um checklist completo considerando o seu público brasileiro e os canais que você já usa...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 px-4 bg-gray-800/50">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Junte-se aos primeiros usuários
          </h2>
          <p className="text-xl text-gray-300 mb-12">
            Milhares de pessoas já estão na lista de espera. Garanta seu acesso antecipado.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="text-4xl font-bold text-orange-500 mb-2">100%</div>
              <div className="text-gray-400 text-sm">Grátis para começar</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-500 mb-2">&lt;30s</div>
              <div className="text-gray-400 text-sm">Para se cadastrar</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-500 mb-2">3</div>
              <div className="text-gray-400 text-sm">Modelos de IA</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-500 mb-2">24/7</div>
              <div className="text-gray-400 text-sm">Disponível</div>
            </div>
          </div>

          {/* Final CTA */}
          <Link 
            href="/pt-br/waitlist"
            className="group inline-flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-10 py-5 rounded-lg font-bold text-xl transition-all shadow-lg hover:shadow-orange-500/50"
          >
            <span>Entrar na Lista de Espera</span>
            <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
          </Link>

          <p className="text-gray-500 text-sm mt-6">
            Sem compromisso. Cancele quando quiser.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              <span className="text-white font-bold">SOULPRINT</span>
            </div>
            <div className="text-gray-400 text-sm">
              © 2025 SoulPrint. Todos os direitos reservados.
            </div>
            <div className="flex space-x-6 text-sm text-gray-400">
              <Link href="/pt-br/waitlist" className="hover:text-orange-500 transition-colors">
                Privacidade
              </Link>
              <Link href="/pt-br/waitlist" className="hover:text-orange-500 transition-colors">
                Termos
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
