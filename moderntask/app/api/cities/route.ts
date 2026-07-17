import { NextRequest, NextResponse } from 'next/server'
import citiesData from '@/data/cities.json'

// Static, pre-generated dataset (135k cities, GeoNames-derived via the
// all-the-cities package) as a plain JSON import instead of requiring the npm
// package directly. That package reads a binary cities.pbf file via
// fs.readFileSync at runtime, which Next.js's serverless output tracing
// doesn't pick up — it built fine locally but 404'd/ENOENT'd in the deployed
// build because cities.pbf never made it into the bundle. A committed JSON
// file has no runtime file dependency, so this is bundler-agnostic.
// Regenerate with: node -e "require('fs').writeFileSync('data/cities.json',
// JSON.stringify(require('all-the-cities').map(c => [c.name, c.country, c.adminCode, c.population])))"
// Shape per row: [name, countryCode, adminCode, population]
const allCities = citiesData as [string, string, string, number][]

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
function countryName(code: string): string {
  try { return regionNames.of(code) || code } catch { return code }
}

// "City, ST" for the US (matches the existing state-targeting format elsewhere
// in the app); "City, Country" everywhere else.
function formatCity([name, country, adminCode]: [string, string, string, number]): string {
  return country === 'US' ? `${name}, ${adminCode}` : `${name}, ${countryName(country)}`
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
  if (q.length < 1) return NextResponse.json({ cities: [] })

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 8, 20)

  const matches = allCities
    .filter(([name, country, adminCode]) =>
      name.toLowerCase().startsWith(q) ||
      (country === 'US' && adminCode.toLowerCase() === q)
    )
    .sort((a, b) => b[3] - a[3])
    .slice(0, limit)
    .map(formatCity)

  return NextResponse.json({ cities: matches })
}
