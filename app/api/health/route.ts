import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function matches(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const healthSecret = process.env.HEALTHCHECK_SECRET;
  const apiUrl = process.env.PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const authorization = request.headers.get('authorization') ?? '';

  if (!cronSecret || !matches(authorization, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!healthSecret || !apiUrl) {
    return NextResponse.json({ status: 'error', reason: 'Health check is not configured.' }, { status: 503 });
  }

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/health/database`, {
      headers: { authorization: `Bearer ${healthSecret}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`API health check returned ${response.status}`);
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Daily database health check failed', error);
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
