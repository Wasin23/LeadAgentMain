"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { MeridianWordmark } from "@/components/ui/meridian-wordmark"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { HorizonHero } from "@/components/demo/horizon-hero"
import { AgentSection } from "@/components/landing/agent-section"
import { AiResearchSection } from "@/components/landing/ai-research-section"
import { OutreachSection } from "@/components/landing/outreach-section"
import { CrmPipelineSection } from "@/components/landing/crm-pipeline-section"
import { TeamSection } from "@/components/landing/team-section"
import { FeaturesCarousel } from "@/components/landing/features-carousel"
import { PricingSection } from "@/components/landing/pricing-section"
import { FaqSection, FooterSection } from "@/components/landing/footer-section"

const LABELS = ['', 'Agents', 'AI Research', 'Outreach', 'CRM Auditor', 'Teams', 'Pricing', 'FAQ', '']

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
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-black/10 px-4 py-1.5 backdrop-blur bg-white/80 sm:px-10">
        <div className="relative flex items-center w-full">

          {/* Left: logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0 z-10">
            <Image src="/MeridianM.png" alt="Meridian" width={48} height={32} className="shrink-0 sm:w-[96px] sm:h-[64px]" />
            <MeridianWordmark className="h-2 w-auto sm:h-2.5" color="#111111" />
          </Link>

          {/* Center: section tabs — hidden on mobile */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-0.5">
            {LABELS.map((label, i) =>
              label ? (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    i === currentStep
                      ? 'text-black bg-black/8'
                      : 'text-black/40 hover:text-black/70'
                  }`}
                >
                  {label}
                </button>
              ) : null
            )}
          </div>

          {/* Right: auth */}
          <div className="flex items-center gap-2 shrink-0 ml-auto z-10">
            <Link href="/signin" className="hidden sm:block px-4 py-1.5 text-sm text-black/50 hover:text-black transition-colors">Sign In</Link>
            <Link href="/signin" className="px-3 py-1.5 text-xs sm:px-4 sm:text-sm font-medium bg-gradient-to-r from-violet-600 to-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity">Start Free</Link>
          </div>

        </div>
      </nav>

      <FeaturesCarousel labels={LABELS}>
        <HorizonHero />
        <AgentSection />
        <AiResearchSection />
        <OutreachSection />
        <CrmPipelineSection />
        <TeamSection />
        <PricingSection />
        <FaqSection />
        <FooterSection />
      </FeaturesCarousel>
    </div>
  )
}
