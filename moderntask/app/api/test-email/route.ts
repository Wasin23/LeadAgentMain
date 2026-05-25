import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const authHeader = req.headers.get('authorization') || ''
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

    const upstream = await fetch(`${apiBase}/api/lead-agent/test-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
      // @ts-ignore
      signal: AbortSignal.timeout(120_000),
    })

    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
