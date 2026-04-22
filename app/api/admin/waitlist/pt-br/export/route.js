// CSV export of the Brazilian Portuguese waitlist.
// Returns every row for offline analysis, import into CRM/ESP, etc.
// Protected by admin auth.

import { getDb } from '@/lib/mongodb';
import { err, requireAdmin } from '@/lib/api-utils';

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function GET(request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return err('UNAUTHORIZED', 401);

    const db = await getDb();
    const items = await db
      .collection('brazilian_waitlist')
      .find({}, { projection: { _id: 0, ip_hash: 0, user_agent: 0 } })
      .sort({ created_at: -1 })
      .toArray();

    const header = ['email', 'region', 'locale', 'source', 'created_at'];
    const rows = items.map((it) =>
      [
        csvEscape(it.email),
        csvEscape(it.region || ''),
        csvEscape(it.locale || 'pt-BR'),
        csvEscape(it.source || ''),
        csvEscape(it.created_at ? new Date(it.created_at).toISOString() : ''),
      ].join(',')
    );

    const csv = [header.join(','), ...rows].join('\n') + '\n';
    const filename = `brazilian-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[pt-br waitlist export] failed:', e?.message || e);
    return err('SERVER_ERROR', 500);
  }
}
