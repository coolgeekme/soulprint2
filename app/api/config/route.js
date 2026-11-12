/**
 * Public client configuration.
 *
 * Exists so the browser does not depend on the BUILD having had these values. NEXT_PUBLIC_*
 * variables are inlined at build time, which means a build without them produces a bundle
 * where Firebase is permanently undefined — the user sees "Google sign-in is currently
 * unavailable" and there is nothing in the UI to explain it. Reading them here, from the
 * server's own environment at request time, makes deployment independent of build-time env.
 *
 * These values are public by design: they ship inside every browser bundle that uses Firebase
 * web auth. No secret belongs in this response — the apiKey here is a project identifier, not
 * a credential. Access is enforced by Firebase security rules and the authorized-domains list.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
