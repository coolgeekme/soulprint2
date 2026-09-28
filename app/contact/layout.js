import { pageMetadata } from '@/lib/seo';

// This route's page.js is a client component, so it cannot export metadata
// itself (Next.js does not allow metadata exports from client components). Metadata lives here instead.

export const metadata = pageMetadata({
  title: 'Contact',
  description:
    'Get in touch with the SoulPrint Engine team about support, press, partnership, or beta access.',
  path: '/contact',
});

export default function ContactLayout({ children }) {
  return children;
}
