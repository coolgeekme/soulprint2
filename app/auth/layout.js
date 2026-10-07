import { pageMetadata } from '@/lib/seo';

// This route's page.js is a client component, so it cannot export metadata
// itself (Next.js does not allow metadata exports from client components). Metadata lives here instead.

export const metadata = pageMetadata({
  title: 'Sign in to SoulPrint Passport',
  absoluteTitle: true,
  description:
    'Sign in to SoulPrint Passport. Internal page, not intended for search indexing.',
  path: '/auth',
  noindex: true,
});

export default function AuthLayout({ children }) {
  return children;
}
