const normalizeUrl = (value: string) => value.replace(/\/$/, "")

export function getSiteUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL

  if (configuredUrl) {
    return normalizeUrl(configuredUrl)
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`
  }

  if (process.env.VERCEL_URL) {
    return `https://${normalizeUrl(process.env.VERCEL_URL)}`
  }

  return "http://localhost:3000"
}