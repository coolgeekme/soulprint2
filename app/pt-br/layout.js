// Brazilian Portuguese locale segment layout.
// Provides pt-BR-specific <head> metadata and updates the document lang
// attribute at runtime. The root <html lang="en"> is set by the top-level
// layout (App Router limitation), so we patch it on the client for pages
// under /pt-br. All code, comments, and server logic remain in English.

export const metadata = {
  title: 'SoulPrint Engine — A IA que te conhece de verdade',
  description:
    'Cansou de reexplicar tudo pra IA? O SoulPrint aprende seu jeito, seu tom e suas preferências. Entra na lista de espera.',
  openGraph: {
    title: 'SoulPrint Engine — A IA que te conhece de verdade',
    description:
      'Uma IA que aprende seu jeito de falar, de pensar e de viver. Chega de repetir tudo toda conversa.',
    locale: 'pt_BR',
    type: 'website',
    siteName: 'SoulPrint Engine',
  },
  alternates: {
    canonical: '/pt-br',
    languages: {
      'pt-BR': '/pt-br',
      en: '/',
    },
  },
};

// Runtime override for the <html lang> attribute. App Router only allows
// the <html> tag in the root layout, so we adjust it on the client for
// accessibility tools, screen readers, and SEO crawlers that execute JS.
const setLangScript = "document.documentElement.setAttribute('lang','pt-BR');";

export default function PtBrLayout({ children }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: setLangScript }} />
      {children}
    </>
  );
}
