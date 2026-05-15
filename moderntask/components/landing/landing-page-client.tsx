"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { MeridianWordmark } from "@/components/ui/meridian-wordmark"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { StarField } from "@/components/landing/star-field"
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
      {/* Fixed ambient environment — persists across all sections */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Primary bloom — center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px]"
          style={{ background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.13) 0%, rgba(79,70,229,0.06) 40%, transparent 70%)' }} />
        {/* Secondary bloom — top right */}
        <div className="absolute -top-32 right-0 w-[600px] h-[500px]"
          style={{ background: 'radial-gradient(ellipse at top right, rgba(139,92,246,0.09) 0%, transparent 65%)' }} />
        {/* Ground glow — bottom center */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px]"
          style={{ background: 'radial-gradient(ellipse at bottom, rgba(99,102,241,0.10) 0%, transparent 70%)' }} />
        {/* Noise grain overlay */}
        <div className="absolute inset-0 opacity-[0.032]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: 'repeat', backgroundSize: '200px 200px' }} />
      </div>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 px-6 py-1.5 backdrop-blur bg-black/40 sm:px-10">
        <div className="relative flex items-center w-full">

          {/* Left: logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0 z-10">
            <Image src="/MeridianM.png" alt="Meridian" width={96} height={64} className="shrink-0" />
            <MeridianWordmark className="h-2.5 w-auto" />
          </Link>

          {/* Center: section tabs — absolutely centered against full nav width */}
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
          <div className="flex items-center gap-2 shrink-0 ml-auto z-10">
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
        <TeamSection />
        <PricingSection />
        <FaqSection />
        <FooterSection />
      </FeaturesCarousel>
    </div>
  )
}
