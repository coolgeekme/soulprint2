import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'SoulPrint Passport — One Persistent Layer Across Every AI',
  absoluteTitle: true,
  description:
    'Your SoulPrint Passport is one persistent layer of you — identity, memory, and context — that travels with you across every AI you use. Free during beta.',
  path: '/passport',
});

// soulprintpassport.ai redirects here, so this URL has to be real. It renders the
// same component as the root route — one component, two URLs, no duplicated markup
// to drift. When the root route becomes the parent-brand page, only that file changes.
export { default } from '../page';
