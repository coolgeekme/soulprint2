import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import {
  isValidSessionId,
  resolveAllowedOrigin,
  shapeSession,
} from '@/lib/checkout-session';

export const dynamic = 'force-dynamic';

/**
 * Verify a Stripe Checkout session for the static product site.
 *
 * The Passport thank-you page lives on Vercel as plain HTML, so it cannot read Stripe or
 * the database. It used to treat the PRESENCE of `?session_id=` as proof of payment:
 * `?plan=founder&session_id=anything` rendered a paid confirmation and reported a $99
 * conversion. A refresh reported it again.
 *
 * This endpoint is the server-side truth that page defers to. Until it answers, the page
 * stays in its neutral "confirming" state — no claim, no invented revenue.
 *
 * The rules live in lib/checkout-session.js so they can be tested without Stripe.
 */

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': resolveAllowedOrigin(request.headers.get('origin')),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
}

function json(body, status, headers) {
  return NextResponse.json(body, { status, headers });
}

export async function OPTIONS(request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request) {
  const headers = corsHeaders(request);
  const sessionId = new URL(request.url).searchParams.get('session_id') || '';

  if (!isValidSessionId(sessionId)) {
    return json({ ok: false, paid: false, error: 'invalid_session_id' }, 400, headers);
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    // Never fall through to "assume paid". An unconfigured server must not confirm orders.
    return json({ ok: false, paid: false, error: 'not_configured' }, 503, headers);
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return json(shapeSession(session), 200, headers);
  } catch (error) {
    // A session Stripe does not recognise is a 404 — it tells the caller nothing about
    // whether some other id exists.
    const notFound = error?.statusCode === 404 || error?.code === 'resource_missing';
    return json(
      { ok: false, paid: false, error: notFound ? 'session_not_found' : 'lookup_failed' },
      notFound ? 404 : 502,
      headers,
    );
  }
}
