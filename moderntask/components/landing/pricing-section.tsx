'use client'

import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

const goToFaq = () =>
  window.dispatchEvent(new CustomEvent('carousel-goto', { detail: { step: 7 } }))

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
    href:  null,
    dim:   false,
  },
]

export function PricingSection() {
  return (
    <section className="relative z-10 px-6 sm:px-12 py-32">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="enter-0 text-4xl sm:text-5xl font-black text-gray-900 tracking-tight mb-4">
            Simple, credit-based pricing.
          </h2>
          <p className="enter-1 text-black/45 text-lg max-w-xl mx-auto">
            Start free, validate the workflow, then scale up. No seat-count games, no per-user fees.
          </p>
        </div>

        <div className="enter-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="card-premium relative flex flex-col rounded-2xl p-6"
              style={plan.tag ? {
                background: 'white',
                border: '1px solid rgba(99,102,241,0.35)',
                boxShadow: 'inset 0 1px 0 rgba(99,102,241,0.15), 0 2px 4px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.08)',
              } : {}}
            >
              {plan.tag && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-b-lg bg-indigo-600 text-white text-[10px] font-bold tracking-widest uppercase">
                  {plan.tag}
                </div>
              )}

              <div className="mb-5">
                <div className="text-[11px] font-bold text-black/30 uppercase tracking-widest mb-3">
                  {plan.name}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-gray-900">{plan.price}</span>
                  {'sub' in plan && plan.sub && (
                    <span className="text-black/35 text-sm">{plan.sub}</span>
                  )}
                </div>
                <div className="text-[12px] text-indigo-400/80 mt-1">{plan.credits}</div>
              </div>

              <div className="space-y-2.5 flex-1 mb-7">
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-px" />
                    <span className="text-[12px] text-black/50 leading-snug">{f}</span>
                  </div>
                ))}
              </div>

              {plan.href ? (
                <Link
                  href={plan.href}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                    plan.tag
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-white/[0.06] hover:bg-white/[0.10] text-black/70 hover:text-gray-900 border border-white/[0.08]'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <button
                  onClick={goToFaq}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all bg-white/[0.06] hover:bg-white/[0.10] text-black/70 hover:text-gray-900 border border-white/[0.08] w-full"
                >
                  {plan.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-black/25 text-sm mt-8">
          All plans include Gmail and Outlook support · No credit card for free trial · Cancel anytime
        </p>
      </div>
    </section>
  )
}
