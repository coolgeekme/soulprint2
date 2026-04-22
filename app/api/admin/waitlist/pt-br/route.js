// Admin endpoint that returns aggregate stats and a paginated list of
// entries from the Brazilian Portuguese waitlist.
// Protected by the standard admin auth (admin or superadmin role).
// Response is shaped to plug into a future cross-country "Master" admin
// via HTTP aggregation — the top-level fields (`total`, `stats`, `items`)
// are intentionally country-agnostic.
//
// GET /api/admin/waitlist/pt-br?page=1&limit=50&region=sao-paulo

import { getDb } from '@/lib/mongodb';
import { ok, err, requireAdmin } from '@/lib/api-utils';

export async function GET(request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return err('UNAUTHORIZED', 401);

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const regionFilter = (url.searchParams.get('region') || '').trim().toLowerCase();

    const db = await getDb();
    const collection = db.collection('brazilian_waitlist');

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const since24h = new Date(now.getTime() - dayMs);
    const since7d = new Date(now.getTime() - 7 * dayMs);
    const since30d = new Date(now.getTime() - 30 * dayMs);

    const match = regionFilter ? { region: regionFilter } : {};

    const [
      total,
      last24h,
      last7d,
      last30d,
      byRegion,
      byDayRaw,
      items,
    ] = await Promise.all([
      collection.countDocuments(match),
      collection.countDocuments({ ...match, created_at: { $gte: since24h } }),
      collection.countDocuments({ ...match, created_at: { $gte: since7d } }),
      collection.countDocuments({ ...match, created_at: { $gte: since30d } }),
      collection
        .aggregate([
          { $match: match },
          { $group: { _id: '$region', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      collection
        .aggregate([
          { $match: { ...match, created_at: { $gte: since30d } } },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$created_at' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray(),
      collection
        .find(match, { projection: { _id: 0, ip_hash: 0, user_agent: 0 } })
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    // Fill in any missing days so the chart shows a continuous 30-day line.
    const byDayMap = new Map(byDayRaw.map((d) => [d._id, d.count]));
    const byDay = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * dayMs);
      const key = d.toISOString().slice(0, 10);
      byDay.push({ date: key, count: byDayMap.get(key) || 0 });
    }

    return ok({
      locale: 'pt-BR',
      total,
      stats: {
        last_24h: last24h,
        last_7d: last7d,
        last_30d: last30d,
        by_region: byRegion.map((r) => ({ region: r._id || 'unspecified', count: r.count })),
        by_day: byDay,
      },
      pagination: {
        page,
        limit,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
      items,
      generated_at: now.toISOString(),
    });
  } catch (e) {
    console.error('[pt-br waitlist admin] GET failed:', e?.message || e);
    return err('SERVER_ERROR', 500);
  }
}
