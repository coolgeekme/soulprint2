import './globals.css'
import ThemeProvider from '@/lib/providers/ThemeProvider'
import { Toaster } from '@/components/ui/toaster'
import ErrorBoundary from '@/components/ErrorBoundary'
import AttributionTracker from '@/components/AttributionTracker'
import Script from 'next/script'

export const metadata = {
  title: 'SoulPrint — Your Personal AI',
  description: 'Stop re-explaining yourself to AI. SoulPrint remembers your tone, your tempo, and your life.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SoulPrint',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#f97316',
  interactiveWidget: 'resizes-content',
}

// Script to set initial theme before React hydration (prevents flash)
const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('soulprint-theme') || 'light';
    document.documentElement.classList.add(theme);
    if (theme === 'light') {
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#0f172a';
    }
  } catch (e) {}
})();
`;

// Orientation lock removed — no longer needed

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        {/* Google Tag Manager */}
        <script dangerouslySetInnerHTML={{__html:`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-WCCXR92H');`}} />
        {/* End Google Tag Manager */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SoulPrint" />
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
        {/* Clean copied text: strip dark-theme colors so paste = black text, no background */}
        <script dangerouslySetInnerHTML={{__html: `
          document.addEventListener('copy', function(e) {
            var sel = window.getSelection();
            if (!sel || sel.isCollapsed) return;
            try {
              var range = sel.getRangeAt(0);
              var frag = range.cloneContents();
              var div = document.createElement('div');
              div.appendChild(frag);
              // Strip all inline color/background styles from copied HTML
              div.querySelectorAll('*').forEach(function(el) {
                el.style.removeProperty('color');
                el.style.removeProperty('background-color');
                el.style.removeProperty('background');
                el.style.removeProperty('-webkit-text-fill-color');
                // Also remove dark theme classes that carry color
                el.classList.remove('text-white', 'text-gray-100', 'text-gray-200', 'text-gray-300', 'text-gray-400');
                el.classList.remove('bg-gray-800', 'bg-gray-900', 'bg-black', 'bg-zinc-800', 'bg-zinc-900');
              });
              // Force root text color to black for paste targets
              div.style.color = '#000000';
              div.style.backgroundColor = 'transparent';
              var html = div.innerHTML;
              var text = sel.toString();
              e.clipboardData.setData('text/plain', text);
              e.clipboardData.setData('text/html', '<div style="color:#000;background:transparent">' + html + '</div>');
              e.preventDefault();
            } catch(err) { /* Allow default copy on error */ }
          });
        `}} />
        <script dangerouslySetInnerHTML={{__html: themeScript}} />
        {/* YouTube IFrame API — preconnect + preload for faster hero video */}
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://s.ytimg.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        <link rel="preload" href="https://www.youtube.com/iframe_api" as="script" />
      </head>
      <body className="bg-[#0a0a0a] text-white antialiased" suppressHydrationWarning>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe 
            src="https://www.googletagmanager.com/ns.html?id=GTM-WCCXR92H"
            height="0" 
            width="0" 
            style={{display:'none',visibility:'hidden'}}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {/* Direct GA4 fallback: GTM-WCCXR92H is currently security-paused by Google. */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-JW09QN4TG1"
          strategy="afterInteractive"
        />
        <Script id="soulprint-ga4" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config','G-JW09QN4TG1');`}
        </Script>
        <ThemeProvider>
          <AttributionTracker />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
