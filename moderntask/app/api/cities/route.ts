import { NextRequest, NextResponse } from 'next/server'

// 135k-city dataset (GeoNames-derived) — kept server-side only. Bundling this
// into a client component would add several MB to the JS payload just for an
// autocomplete dropdown, so it's loaded once per server process here and
// queried through this route instead.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const allCities: { name: string; country: string; adminCode: string; population: number }[] = require('all-the-cities')

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
function countryName(code: string): string {
  try { return regionNames.of(code) || code } catch { return code }
}

// "City, ST" for the US (matches the existing state-targeting format elsewhere
// in the app); "City, Country" everywhere else.
function formatCity(c: { name: string; country: string; adminCode: string }): string {
  return c.country === 'US' ? `${c.name}, ${c.adminCode}` : `${c.name}, ${countryName(c.country)}`
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
  if (q.length < 1) return NextResponse.json({ cities: [] })

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 8, 20)

  const matches = allCities
    .filter(c =>
      c.name.toLowerCase().startsWith(q) ||
      (c.country === 'US' && c.adminCode.toLowerCase() === q)
    )
    .sort((a, b) => b.population - a.population)
    .slice(0, limit)
    .map(formatCity)

  return NextResponse.json({ cities: matches })
}
