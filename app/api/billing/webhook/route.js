import { NextResponse } from 'next/server';
import { handleStripeWebhook } from '@/lib/handlers/pricing';

/**
 * POST /api/billing/webhook
 * Stripe webhook endpoint — matches the URL configured in Stripe Dashboard.
 * Proxies to the shared handleStripeWebhook handler in pricing.js.
 */
export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    const result = await handleStripeWebhook(body, signature);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Billing Webhook] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
