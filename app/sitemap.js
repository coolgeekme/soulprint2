import { SITE_URL } from '@/lib/seo';
import { getDb } from '@/lib/mongodb';

/**
 * sitemap.xml — generated at /sitemap.xml by the Next.js metadata API.
 *
 * Only publicly indexable pages appear here, and the list mirrors the Allow
 * side of app/robots.js. Private app routes, mid-funnel steps, and the
 * archived /og-pages duplicates are deliberately absent.
 *
 * Blog posts are read from Mongo so new posts land in the sitemap without a
 * code change. That read is wrapped: a database hiccup degrades the sitemap to
 * its static pages rather than breaking it, and `revalidate` refreshes the
 * result hourly so a failed read self-heals.
 */

/**
 * Always render on request, never at build time.
 *
 * The build runs on the Emergent pod, whose MONGO_URL points at its LOCAL
 * preview database — not production Atlas. A prerendered sitemap therefore
 * bakes in whatever the preview DB happens to hold (in practice: no posts),
 * and serves that stale list until ISR's first revalidation an hour later.
 * That window repeats on EVERY deploy.
 *
 * force-dynamic makes the first render happen in the production runtime, so
 * the post list is read from the live database from the very first request.
 * The query is a single indexed lookup and crawlers fetch a sitemap rarely,
 * so the cost is negligible next to being wrong.
 */
export const dynamic = 'force-dynamic';

const LAST_CONTENT_REVIEW = new Date('2026-09-28');

/** Static public routes. `priority` reflects how central the page is to the product story. */
const STATIC_ROUTES = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/how-it-works', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/features', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/integrations', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/connect', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/pricing', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/early-access', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/blog', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/security', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.4 },
];

/** Published blog posts, newest first. Returns [] if the database is unreachable. */
async function blogEntries() {
  try {
    const db = await getDb();
    const posts = await db
      .collection('blog_posts')
      .find(
        { status: 'published', slug: { $type: 'string', $ne: '' } },
        { projection: { slug: 1, updated_at: 1, published_at: 1, created_at: 1 } }
      )
      .sort({ published_at: -1 })
      .limit(5000)
      .toArray();

    return posts.map((post) => {
      const stamp = post.updated_at || post.published_at || post.created_at;
      return {
        url: `${SITE_URL}/blog/${post.slug}`,
        lastModified: stamp ? new Date(stamp) : LAST_CONTENT_REVIEW,
        changeFrequency: 'monthly',
        priority: 0.6,
      };
    });
  } catch (error) {
    console.error('[sitemap] blog posts unavailable, serving static routes only:', error?.message);
    return [];
  }
}

export default async function sitemap() {
  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: route.path === '/' ? SITE_URL : `${SITE_URL}${route.path}`,
    lastModified: LAST_CONTENT_REVIEW,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  return [...staticEntries, ...(await blogEntries())];
}
