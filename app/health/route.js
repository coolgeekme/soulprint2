import { NextResponse } from 'next/server';

// Health check endpoint for deployment/monitoring
// This responds to GET /health
export async function GET() {
  return NextResponse.json(
    { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'soulprint-api'
    }, 
    { status: 200 }
  );
}
