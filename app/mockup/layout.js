import { pageMetadata } from '@/lib/seo';

// This route's page.js is a client component, so it cannot export metadata
// itself (Next.js does not allow metadata exports from client components). Metadata lives here instead.

export const metadata = pageMetadata({
  title: 'Mockup',
  description:
    'Internal SoulPrint Engine page. Not intended for search indexing.',
  path: '/mockup',
  noindex: true,
});

export default function MockupLayout({ children }) {
  return children;
}
