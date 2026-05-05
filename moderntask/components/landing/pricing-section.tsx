'use client'

import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

const PLANS = [
  {
    name:    'Free Trial',
    price:   '$0',
    credits: '250 credits',
    tag:     null,
    features: [
      '250 free credits',
      'Gmail or Outlook',
      'AI lead research',
      'Personalized email writing',
      'Open and reply tracking',
      '1 agent included',
    ],
    cta:   'Start free',
    href:  '/signin',
    dim:   false,
  },
  {
    name:    'Basic',
    price:   '$100',
    sub:     '/ month',
    credits: '1,200 credits',
    tag:     null,
    features: [
      'Everything in Free Trial',
      '1,200 credits / month',
      'Up to 3 agents',
      '5× concurrency',
      'Automated follow-ups',
      'CRM pipeline',
    ],
    cta:   'Get started',
    href:  '/signin',
    dim:   false,
  },
  {
    name:    'Starter',
    price:   '$500',
    sub:     '/ month',
    credits: '13,000 credits',
    tag:     null,
    features: [
      'Everything in Basic',
      '13,000 credits / month',
      'Up to 5 agents',
      '10× concurrency',
      'Timezone-aware sending',
      'Company intelligence',
    ],
    cta:   'Get started',
    href:  '/signin',
    dim:   false,
  },
  {
    name:    'Professional',
    price:   '$1,000',
    sub:     '/ month',
    credits: '30,000 credits',
    tag:     'Most popular',
    features: [
      'Everything in Starter',
      '30,000 credits / month',
      'Up to 10 agents',
      '20× concurrency',
      'Calendar integration',
      'Advanced analytics',
    ],
    cta:   'Get started',
    href:  '/signin',
    dim:   false,
  },
  {
    name:    'Enterprise',
    price:   '$2,500',
    sub:     '/ month',
    credits: '70,000 credits',
    tag:     null,
    features: [
      'Everything in Professional',
      '70,000 credits / month',
      'Up to 30 agents',
      '30× concurrency',
      'Dedicated onboarding',
      'Priority support',
    ],
    cta:   'Contact us',
    href:  '/signin',
    dim:   false,
  },
]

export function PricingSection() {
  return (
    <section className="relative z-10 px-6 sm:px-12 py-32">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Simple, credit-based pricing.
          </h2>
          <p className="text-white/45 text-lg max-w-xl mx-auto">
            Start free, validate the workflow, then scale up — no seat-count games, no per-user fees.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col bg-[#06081a] p-6 ${
                plan.tag ? 'ring-1 ring-inset ring-indigo-500/50' : ''
              }`}
            >
              {plan.tag && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-b-lg bg-indigo-600 text-white text-[10px] font-bold tracking-widest uppercase">
                  {plan.tag}
                </div>
              )}

              <div className="mb-5">
                <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">
                  {plan.name}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  {'sub' in plan && plan.sub && (
                    <span className="text-white/35 text-sm">{plan.sub}</span>
                  )}
                </div>
                <div className="text-[12px] text-indigo-400/80 mt-1">{plan.credits}</div>
              </div>

              <div className="space-y-2.5 flex-1 mb-7">
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-px" />
                    <span className="text-[12px] text-white/50 leading-snug">{f}</span>
                  </div>
                ))}
              </div>

              <Link
                href={plan.href}
                className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                  plan.tag
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-white/[0.06] hover:bg-white/[0.10] text-white/70 hover:text-white border border-white/[0.08]'
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-white/25 text-sm mt-8">
          All plans include Gmail and Outlook support · No credit card for free trial · Cancel anytime
        </p>
      </div>
    </section>
  )
}
