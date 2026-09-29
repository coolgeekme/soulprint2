import { pageMetadata } from '@/lib/seo';

// This route's page.js is a client component, so it cannot export metadata
// itself (Next.js does not allow metadata exports from client components). Metadata lives here instead.

export const metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'How SoulPrint Engine collects, stores, and protects your data — what lives in your Passport, what we never sell, and the controls you have.',
  path: '/privacy',
});

export default function PrivacyLayout({ children }) {
  return children;
}
