'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type Agent = {
  id: string
  name: string
  title: string
  avatar: string
  traits: string[]
  email: { subject: string; body: string }
  accent: string
  ring: string
}

const AGENTS: Agent[] = [
  {
    id: 'hunter',
    name: 'Hunter',
    title: 'High-Volume Prospector',
    avatar: '/avatars/Hunter.png',
    accent: '#fb923c',
    ring: 'rgba(251,146,60,0.6)',
    traits: ['Competitive', 'Relentless', 'Confident'],
    email: {
      subject: "Scaling Rippling's pipeline, fast",
      body: `Hey Marcus,

Noticed Rippling just closed its Series B. Growth stage is exactly when pipeline velocity becomes the bottleneck.

We get companies like yours 2,000+ qualified leads/month. No new headcount, no manual prospecting.

15 minutes this week?`,
    },
  },
  {
    id: 'relationship',
    name: 'Relationship Builder',
    title: 'Warm Outreach Specialist',
    avatar: '/avatars/Relationship-Builder.png',
    accent: '#4ade80',
    ring: 'rgba(74,222,128,0.6)',
    traits: ['Empathetic', 'Genuine', 'Patient'],
    email: {
      subject: 'Your post on async workflows, wanted to reach out',
      body: `Hi Sarah,

I came across Notion while researching SaaS leaders, specifically the work you've been doing around the AI-powered docs rollout. Really thoughtful approach.

We've helped a few similar teams build more sustainable outbound. Not a pitch. I'd genuinely love to hear where you're taking things this year.

Open for a quick call?`,
    },
  },
  {
    id: 'analyst',
    name: 'Analyst',
    title: 'Data-Driven Targeting',
    avatar: '/avatars/Analyst.png',
    accent: '#60a5fa',
    ring: 'rgba(96,165,250,0.6)',
    traits: ['Precise', 'Methodical', 'Skeptical'],
    email: {
      subject: "Figma's outbound efficiency: a data point",
      body: `Jordan,

Companies at Figma's stage average 1.2% cold reply rates. Our clients in the same product-led SaaS cohort average 4.7%.

The delta comes down to research depth and send timing. I pulled a breakdown specific to your segment that you might find useful.

Worth 20 minutes?`,
    },
  },
  {
    id: 'consultant',
    name: 'Consultant',
    title: 'Strategic Advisor',
    avatar: '/avatars/consultant.png',
    accent: '#c084fc',
    ring: 'rgba(192,132,252,0.6)',
    traits: ['Authoritative', 'Thoughtful', 'Measured'],
    email: {
      subject: 'Q3 pipeline architecture for Brex',
      body: `David,

Based on Brex's recent sales hiring and the push into enterprise, it looks like you're scaling outbound hard this quarter.

Most VPs I work with at this stage hit the same structural constraint: top-of-funnel can't keep pace with what the team can actually close.

I've helped a few companies solve this. Would it be worth a conversation?`,
    },
  },
  {
    id: 'networker',
    name: 'Networker',
    title: 'LinkedIn-First Outreach',
    avatar: '/avatars/Networker.png',
    accent: '#818cf8',
    ring: 'rgba(129,140,248,0.6)',
    traits: ['Charismatic', 'Curious', 'Social'],
    email: {
      subject: 'Connected through James Chen, quick note',
      body: `Alex,

Saw we're both connected to James Chen and you've been active in Revenue Collective lately. Loved your take on the PLG-to-enterprise motion.

I've been working with a few people from that group on something I think you'd find relevant, and wanted to reach out directly.

Happy to keep it informal. A quick call or even just a message back works.`,
    },
  },
]

export function AgentSection() {
  const [active, setActive] = useState(0)
  const [fading, setFading] = useState(false)

  const switchTo = (i: number) => {
    if (i === active) return
    setFading(true)
    setTimeout(() => { setActive(i); setFading(false) }, 160)
  }

  useEffect(() => {
    const t = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setActive(a => (a + 1) % AGENTS.length)
        setFading(false)
      }, 160)
    }, 8000)
    return () => clearInterval(t)
  }, [])

  const agent = AGENTS[active]

  return (
    <section className="relative z-10 py-28 px-6">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-center gap-16">

        {/* left copy */}
        <div className="flex-1 max-w-[460px] shrink-0">
          <p className="text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-4">Agents</p>
          <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
            Your agent.<br />Five personalities.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-8">
            Every agent runs autonomously: finding leads, researching accounts, writing personalized emails, and managing follow-ups. Pick the personality that fits your sales motion.
          </p>
          <div className="space-y-3 mb-10">
            {[
              'Runs on your ICP, 24 hours a day',
              'Learns which strategies work and adapts',
              'Integrates with Gmail, Outlook, and your CRM',
              'Stops and re-routes when sources are exhausted',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-white/55 text-[15px]">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <Link href="/signin" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105">
            Start free
          </Link>
        </div>

        {/* right: face lineup + email preview */}
        <div className="flex-1 w-full min-w-0 flex flex-col gap-8">

          {/* face row */}
          <div className="flex items-end justify-between gap-2">
            {AGENTS.map((a, i) => {
              const isActive = i === active
              return (
                <button
                  key={a.id}
                  onClick={() => switchTo(i)}
                  className="flex flex-col items-center gap-2.5 group"
                  style={{ transition: 'transform 0.2s', transform: isActive ? 'scale(1.08)' : 'scale(0.93)' }}
                >
                  {/* avatar */}
                  <div
                    className="rounded-full overflow-hidden transition-all duration-300"
                    style={{
                      width: 80,
                      height: 80,
                      boxShadow: isActive ? `0 0 0 3px ${a.ring}, 0 0 24px ${a.ring}` : '0 0 0 2px rgba(255,255,255,0.06)',
                      opacity: isActive ? 1 : 0.38,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                  </div>
                  {/* name + traits */}
                  <div className="text-center">
                    <div
                      className="text-[12px] font-bold leading-tight transition-colors duration-200"
                      style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.28)' }}
                    >
                      {a.name}
                    </div>
                    <div
                      className="text-[9px] leading-tight mt-0.5 transition-colors duration-200"
                      style={{ color: isActive ? a.accent : 'rgba(255,255,255,0.15)' }}
                    >
                      {a.title}
                    </div>
                    {isActive && (
                      <div className="flex flex-wrap justify-center gap-1 mt-2">
                        {a.traits.map(t => (
                          <span
                            key={t}
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: `rgba(${hexToRgb(a.accent)},0.12)`, color: a.accent }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* email preview */}
          <div
            className="rounded-2xl overflow-hidden transition-all duration-160"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(5,7,15,1) 100%)',
              border: `1px solid rgba(${hexToRgb(agent.accent)},0.28)`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.6), 0 0 40px rgba(${hexToRgb(agent.accent)},0.04)`,
              opacity: fading ? 0 : 1,
              transform: fading ? 'translateY(6px)' : 'translateY(0)',
            }}
          >
            {/* email header bar */}
            <div
              className="px-4 py-2.5 border-b flex items-center gap-3"
              style={{ borderColor: `rgba(${hexToRgb(agent.accent)},0.14)`, background: `rgba(${hexToRgb(agent.accent)},0.05)` }}
            >
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: agent.accent }} />
              <span className="text-[10px] font-mono" style={{ color: `rgba(${hexToRgb(agent.accent)},0.7)` }}>
                draft · {agent.name.toLowerCase()}
              </span>
            </div>

            {/* subject */}
            <div className="px-5 pt-4 pb-2 border-b border-white/[0.04]">
              <span className="text-[10px] text-white/20 uppercase tracking-widest mr-2">Subject</span>
              <span className="text-[13px] text-white/75 font-semibold">{agent.email.subject}</span>
            </div>

            {/* body */}
            <div className="px-5 py-4 space-y-3">
              {agent.email.body.split('\n\n').map((para, i) => (
                <p key={i} className="text-[13px] leading-relaxed text-white/60">
                  {para}
                </p>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
