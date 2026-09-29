import { pageMetadata } from '@/lib/seo';

// This route's page.js is a client component, so it cannot export metadata
// itself (Next.js does not allow metadata exports from client components). Metadata lives here instead.

export const metadata = pageMetadata({
  title: 'Security',
  description:
    'How we protect your SoulPrint: encryption in transit and at rest, access control, and the architecture behind the Passport.',
  path: '/security',
});

export default function SecurityLayout({ children }) {
  return children;
}
