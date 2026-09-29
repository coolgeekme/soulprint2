import { pageMetadata } from '@/lib/seo';

// This route's page.js is a client component, so it cannot export metadata
// itself (Next.js does not allow metadata exports from client components). Metadata lives here instead.

export const metadata = pageMetadata({
  title: 'Terms of Service',
  description:
    'The terms governing your use of SoulPrint Engine and the SoulPrint Passport, including beta terms, accounts, and acceptable use.',
  path: '/terms',
});

export default function TermsLayout({ children }) {
  return children;
}
