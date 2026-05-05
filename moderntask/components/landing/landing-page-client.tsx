"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { StarField } from "@/components/landing/star-field"
import { HorizonHero } from "@/components/demo/horizon-hero"
import { AgentSection } from "@/components/landing/agent-section"
import { AiResearchSection } from "@/components/landing/ai-research-section"
import { OutreachSection } from "@/components/landing/outreach-section"
import { CrmPipelineSection } from "@/components/landing/crm-pipeline-section"
import { FeaturesCarousel } from "@/components/landing/features-carousel"
import { PricingSection } from "@/components/landing/pricing-section"
import { FooterSection } from "@/components/landing/footer-section"

const LABELS = ['', 'Agents', 'AI Research', 'Outreach', 'CRM Auditor', 'Pricing', '']

export function LandingPageClient() {
  const { user } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (user) router.replace("/home")
  }, [router, user])

  useEffect(() => {
    const onStep = (e: Event) => setCurrentStep((e as CustomEvent).detail.step as number)
    window.addEventListener('carousel-step', onStep)
    return () => window.removeEventListener('carousel-step', onStep)
  }, [])

  const goTo = (i: number) =>
    window.dispatchEvent(new CustomEvent('carousel-goto', { detail: { step: i } }))

  return (
    <div className="text-foreground overflow-hidden h-screen">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 px-6 py-4 backdrop-blur bg-black/40 sm:px-10">
        <div className="mx-auto max-w-7xl relative flex items-center">

          {/* Left: logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none" className="text-white">
              <ellipse cx="24" cy="24" rx="6"  ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="14" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="8"  stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="16" stroke="currentColor" strokeWidth="1.5" />
              <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-lg font-bold tracking-tight text-white">Meridian</span>
          </Link>

          {/* Center: section tabs */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5">
            {LABELS.map((label, i) =>
              label ? (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    i === currentStep
                      ? 'text-white bg-white/10'
                      : 'text-white/45 hover:text-white/75'
                  }`}
                >
                  {label}
                </button>
              ) : null
            )}
          </div>

          {/* Right: auth */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Link href="/signin" className="px-4 py-1.5 text-sm text-white/70 hover:text-white transition-colors">Sign In</Link>
            <Link href="/signin" className="px-4 py-1.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-colors">Start Free</Link>
          </div>

        </div>
      </nav>

      <StarField fixed />
      <FeaturesCarousel labels={LABELS}>
        <HorizonHero />
        <AgentSection />
        <AiResearchSection />
        <OutreachSection />
        <CrmPipelineSection />
        <PricingSection />
        <FooterSection />
      </FeaturesCarousel>
    </div>
  )
}
