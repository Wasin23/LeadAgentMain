"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useAuth } from "@/contexts/AuthContext"
import { StarField } from "@/components/landing/star-field"
import { AiResearchSection } from "@/components/landing/ai-research-section"
import { GlobeCrmSection } from "@/components/landing/globe-crm-section"
import { PricingSection } from "@/components/landing/pricing-section"
import { FooterSection } from "@/components/landing/footer-section"

const HorizonHero = dynamic(
  () => import("@/components/demo/horizon-hero").then((m) => ({ default: m.HorizonHero })),
  { ssr: false, loading: () => <div className="h-screen w-full bg-[#03050d]" /> }
)

export function LandingPageClient() {
  const { user } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (user) router.replace("/home")
  }, [router, user])

  return (
    <div className="text-foreground overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 px-6 py-4 backdrop-blur bg-black/40 sm:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none" className="text-white">
              <ellipse cx="24" cy="24" rx="6" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="14" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="8" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="16" stroke="currentColor" strokeWidth="1.5" />
              <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-lg font-bold tracking-tight text-white">Meridian</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/signin" className="px-4 py-1.5 text-sm text-white/70 hover:text-white transition-colors">Sign In</Link>
            <Link href="/signin" className="px-4 py-1.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-colors">Start Free</Link>
          </div>
        </div>
      </nav>

      <StarField fixed />
      <HorizonHero />
      <AiResearchSection />
      <GlobeCrmSection />
      <PricingSection />
      <FooterSection />
    </div>
  )
}
