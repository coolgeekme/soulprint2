/**
 * API Route: /api/infographic/generate
 * 
 * Generates pixel-perfect infographics from structured data using HTML/CSS rendering.
 * No AI hallucination — all text/numbers are 100% accurate.
 */

import { NextResponse } from 'next/server';
import { generateInfographic } from '@/lib/infographic-generator';

export async function POST(request) {
  try {
    const body = await request.json();
    const { data, template = 'comparison' } = body;

    if (!data) {
      return NextResponse.json({ error: 'Missing data object' }, { status: 400 });
    }

    const imageBuffer = await generateInfographic(data, template);

    // Return the image directly
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="infographic-${Date.now()}.png"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Infographic] Generation error:', error);
    return NextResponse.json({ error: 'Failed to generate infographic', details: error.message }, { status: 500 });
  }
}
