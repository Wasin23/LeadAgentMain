import type { Metadata } from "next"
import { LandingPageClient } from "@/components/landing/landing-page-client"
import { getSiteUrl } from "@/lib/site-url"

const siteUrl = getSiteUrl()

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Meridian",
      url: siteUrl,
    },
    {
      "@type": "SoftwareApplication",
      name: "Meridian",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description:
        "Meridian is AI cold email software for lead research, personalized outreach, automated follow-ups, and reply tracking from your own inbox.",
      offers: [
        {
          "@type": "Offer",
          name: "Free Trial",
          price: "0",
          priceCurrency: "USD",
          description: "250 free credits with no credit card required.",
        },
        {
          "@type": "Offer",
          name: "Starter",
          price: "500",
          priceCurrency: "USD",
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: "Meridian",
  description:
    "Meridian is AI cold email software that finds leads, researches accounts, writes personalized outreach, automates follow-ups, and tracks replies from your real inbox.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Meridian",
    description:
      "Research leads, write personalized cold emails, automate follow-ups, and keep replies in one outbound workflow.",
    url: siteUrl,
  },
  twitter: {
    title: "Meridian",
    description:
      "AI-powered lead research, personalized cold email writing, automated follow-ups, and reply tracking from your own inbox.",
  },
}

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingPageClient />
    </>
  )
}
