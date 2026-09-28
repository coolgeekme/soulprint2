import { pageMetadata } from '@/lib/seo';
import { getDb } from '@/lib/mongodb';

// app/blog/[slug]/page.js is a client component and fetches its post in the
// browser, so search engines would otherwise see the generic site title on
// every article. This layout reads the same Mongo record on the server and
// emits per-post metadata.
//
// The lookup is best-effort: if the database is unreachable the page still
// renders with a sensible fallback rather than failing.

function truncate(text, max = 155) {
  if (!text) return null;
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : max).trim()}…`;
}

function fallback(slug) {
  return pageMetadata({
    title: 'SoulPrint Blog',
    description:
      'Product updates and writing from the SoulPrint Engine team on persistent AI memory, identity, and the layer between you and every model you use.',
    path: `/blog/${slug || ''}`,
  });
}

export async function generateMetadata({ params }) {
  const slug = params?.slug;
  if (!slug) return fallback(slug);

  try {
    const db = await getDb();
    const post = await db.collection('blog_posts').findOne(
      { slug, status: 'published' },
      { projection: { title: 1, excerpt: 1, content: 1, featured_image: 1 } }
    );

    if (!post?.title) return fallback(slug);

    const image = post.featured_image
      ? [{ url: post.featured_image, width: 1200, height: 630, alt: post.title }]
      : undefined;

    return pageMetadata({
      title: post.title,
      // Blog headlines are self-describing, so skip the "| SoulPrint Engine" suffix.
      absoluteTitle: true,
      description:
        truncate(post.excerpt) ||
        truncate(String(post.content || '').replace(/[#*_`>]/g, '')) ||
        `Read "${post.title}" on the SoulPrint Engine blog.`,
      path: `/blog/${slug}`,
      type: 'article',
      images: image,
    });
  } catch (error) {
    console.error('[blog] metadata lookup failed for', slug, error?.message);
    return fallback(slug);
  }
}

export default function BlogPostLayout({ children }) {
  return children;
}
