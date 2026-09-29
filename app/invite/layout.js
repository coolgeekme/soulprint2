import { pageMetadata } from '@/lib/seo';

// This route's page.js is a client component, so it cannot export metadata
// itself (Next.js does not allow metadata exports from client components). Metadata lives here instead.

export const metadata = pageMetadata({
  title: 'Invitation',
  description:
    'Internal SoulPrint Engine page. Not intended for search indexing.',
  path: '/invite',
  noindex: true,
});

export default function InviteLayout({ children }) {
  return children;
}
