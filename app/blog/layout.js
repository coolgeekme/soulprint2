import { pageMetadata } from '@/lib/seo';

// app/blog/page.js is a client component, so this server layout carries the
// metadata for the blog index.

export const metadata = pageMetadata({
  title: 'Blog — Notes on Persistent AI Memory',
  description:
    "Product updates and writing from the SoulPrint Engine team on persistent AI memory, identity, and the layer that sits between you and every model you use.",
  path: '/blog',
});

export default function BlogLayout({ children }) {
  return children;
}
