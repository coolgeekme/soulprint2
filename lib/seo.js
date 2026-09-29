/**
 * Shared metadata builder.
 *
 * Every public page routes through here so titles, canonicals, and social
 * cards stay consistent — and so the Next.js title template in app/layout.js
 * only has to be defined once.
 *
 * Usage (server components only):
 *
 *   import { pageMetadata } from '@/lib/seo';
 *   export const metadata = pageMetadata({
 *     title: 'Pricing — Free During Beta',
 *     description: 'SoulPrint is free while we are in beta...',
 *     path: '/pricing',
 *   });
 */

export const SITE_URL = 'https://soulprintengine.ai';
export const SITE_NAME = 'SoulPrint Engine';

/** Default social card. Lives in /public, 1200x630. */
export const DEFAULT_OG_IMAGE = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: 'SoulPrint Engine — one persistent layer of you, across every AI you use',
};

/**
 * Build a metadata object for a public page.
 *
 * @param {object}   o
 * @param {string}   o.title            Page title. The root template appends "| SoulPrint Engine".
 * @param {string}   o.description      Meta description, ~150 chars.
 * @param {string}   o.path             Route path, e.g. "/pricing". Used for the canonical URL.
 * @param {string}  [o.ogTitle]         Override for the social title (defaults to title).
 * @param {string}  [o.ogDescription]   Override for the social description.
 * @param {string}  [o.type]            Open Graph type. Default "website".
 * @param {Array}   [o.images]          Open Graph images. Defaults to the site card.
 * @param {boolean} [o.absoluteTitle]   true = ignore the title template (use on the homepage).
 * @param {boolean} [o.noindex]         true = emit robots noindex,nofollow and keep it out of search.
 * @param {string}  [o.canonical]       Override the canonical path when it differs from `path`.
 */
export function pageMetadata({
  title,
  description,
  path,
  ogTitle,
  ogDescription,
  type = 'website',
  images,
  absoluteTitle = false,
  noindex = false,
  canonical,
}) {
  const ogImg = images || [DEFAULT_OG_IMAGE];

  /** @type {import('next').Metadata} */
  const meta = {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: canonical || path },
    openGraph: {
      title: ogTitle || title,
      description: ogDescription || description,
      url: path,
      siteName: SITE_NAME,
      type,
      images: ogImg,
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle || title,
      description: ogDescription || description,
      images: ogImg.map((i) => i.url),
    },
  };

  if (noindex) {
    meta.robots = {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false },
    };
  }

  return meta;
}
