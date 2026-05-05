'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Target, Users, BarChart2, Briefcase, Globe } from 'lucide-react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

type Agent = {
  id: string
  name: string
  Icon: LucideIcon
  tagline: string
  description: string
  capabilities: string[]
  traits: string[]
  stats: { label: string; value: string }[]
  color: { accent: string; chip: string; border: string; text: string }
}

const AGENTS: Agent[] = [
  {
    id: 'hunter',
    name: 'Hunter',
    Icon: Target,
    tagline: 'High-volume prospecting.',
    description: 'Built for scale. Goes wide across your ICP — sourcing large volumes fast, prioritizing pipeline velocity over deep personalization.',
    capabilities: [
      'Sources thousands of qualified leads per cycle',
      'Auto-adjusts search to avoid source exhaustion',
      'Prioritizes companies with active hiring signals',
      'Optimized for top-of-funnel volume',
    ],
    traits: ['High Volume', 'Fast Cycle', 'Wide Net'],
    stats: [
      { label: 'Leads / day', value: '3,000' },
      { label: 'Email style', value: 'Direct' },
      { label: 'Research', value: 'Light' },
    ],
    color: { accent: '#fb923c', chip: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.22)', text: '#fdba74' },
  },
  {
    id: 'relationship',
    name: 'Relationship Builder',
    Icon: Users,
    tagline: 'Warm, consultative outreach.',
    description: "Moves slower, personalizes harder. Crafts account-specific emails that reference real signals and don't feel automated.",
    capabilities: [
      'Reads funding news and LinkedIn before writing',
      'References specific company signals in every email',
      'Follows up with context — not copy-paste templates',
      'Optimized for reply rate over raw volume',
    ],
    traits: ['High Reply Rate', 'Deep Research', 'Warm Tone'],
    stats: [
      { label: 'Leads / day', value: '3,000' },
      { label: 'Email style', value: 'Warm' },
      { label: 'Research', value: 'Deep' },
    ],
    color: { accent: '#4ade80', chip: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.22)', text: '#86efac' },
  },
  {
    id: 'analyst',
    name: 'Analyst',
    Icon: BarChart2,
    tagline: 'Data-driven precision targeting.',
    description: 'Scores every lead before writing a word. Heavy on qualification logic — sends fewer emails, wastes fewer credits.',
    capabilities: [
      'Pre-qualifies every lead against your ICP',
      'Scores by funding stage, tech stack, and headcount',
      'Writes ROI-framed emails with specific numbers',
      'Flags low-fit leads before they waste a credit',
    ],
    traits: ['High Precision', 'Low Waste', 'Data-Driven'],
    stats: [
      { label: 'Leads / day', value: '3,000' },
      { label: 'Email style', value: 'Data-backed' },
      { label: 'Research', value: 'Medium' },
    ],
    color: { accent: '#60a5fa', chip: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.22)', text: '#93c5fd' },
  },
  {
    id: 'consultant',
    name: 'Consultant',
    Icon: Briefcase,
    tagline: 'Strategic advisor positioning.',
    description: 'Frames your offer as the solution to a real business problem. Best for complex deals and long enterprise sales cycles.',
    capabilities: [
      'Reads press releases, earnings calls, and job postings',
      'Frames outreach around outcomes — not features',
      'Tailored for VP+ and C-suite buyers',
      'Supports multi-step sequences with context carry-over',
    ],
    traits: ['Enterprise Focus', 'Long-Form', 'Strategic'],
    stats: [
      { label: 'Leads / day', value: '3,000' },
      { label: 'Email style', value: 'Strategic' },
      { label: 'Research', value: 'Deep' },
    ],
    color: { accent: '#c084fc', chip: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.22)', text: '#d8b4fe' },
  },
  {
    id: 'networker',
    name: 'Networker',
    Icon: Globe,
    tagline: 'LinkedIn-first, community-driven.',
    description: "Taps LinkedIn signals first — posts, job changes, company news. Writes emails that feel like they came from someone who actually follows them.",
    capabilities: [
      'Pulls LinkedIn activity, posts, and company announcements',
      'References specific milestones and recent news',
      'Writes peer-to-peer tone that avoids "salesy" triggers',
      'Great for founder-led sales and SMB markets',
    ],
    traits: ['LinkedIn-Heavy', 'Social Feel', 'Peer-to-Peer'],
    stats: [
      { label: 'Leads / day', value: '3,000' },
      { label: 'Email style', value: 'Conversational' },
      { label: 'Research', value: 'Medium' },
    ],
    color: { accent: '#818cf8', chip: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.22)', text: '#a5b4fc' },
  },
]

export function AgentSection() {
  const [active, setActive] = useState(0)
  const [fading, setFading] = useState(false)

  const switchTo = (i: number) => {
    if (i === active) return
    setFading(true)
    setTimeout(() => { setActive(i); setFading(false) }, 150)
  }

  useEffect(() => {
    const t = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setActive(a => (a + 1) % AGENTS.length)
        setFading(false)
      }, 150)
    }, 3800)
    return () => clearInterval(t)
  }, [])

  const agent = AGENTS[active]
  const ActiveIcon = agent.Icon

  return (
    <section className="relative z-10 py-28 px-6">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-center gap-16">

        {/* ── Left copy ── */}
        <div className="flex-1 max-w-[460px] shrink-0">
          <p className="text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-4">Agents</p>
          <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
            Your agent.<br />Five personalities.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-8">
            Every agent runs autonomously — finding leads, researching accounts, writing personalized emails, and managing follow-ups. Pick the personality that fits your sales motion.
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

        {/* ── Right: agent panel ── */}
        <div className="flex-1 w-full min-w-0">
          <div className="rounded-2xl border border-white/[0.08] bg-[#05070f] overflow-hidden shadow-2xl shadow-black/60">

            {/* Title bar */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.06] bg-[#05070f]">
              <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <div className="w-2 h-2 rounded-full bg-[#28c840]" />
              <span className="ml-2 text-[10px] text-white/20 font-mono">meridian · agents</span>
              <span className="ml-auto text-[9px] text-indigo-400/60 font-mono">1 active</span>
            </div>

            {/* Body */}
            <div className="flex" style={{ minHeight: 380 }}>

              {/* Agent list */}
              <div className="w-[180px] shrink-0 border-r border-white/[0.06] py-2">
                {AGENTS.map((a, i) => {
                  const ListIcon = a.Icon
                  return (
                    <button
                      key={a.id}
                      onClick={() => switchTo(i)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-all ${
                        i === active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <ListIcon
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: i === active ? a.color.text : 'rgba(255,255,255,0.2)' }}
                      />
                      <div className="min-w-0">
                        <div className={`text-[11px] font-semibold truncate ${i === active ? 'text-white/85' : 'text-white/35'}`}>
                          {a.name}
                        </div>
                        {i === active && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="w-1 h-1 rounded-full bg-green-400" />
                            <span className="text-[9px] text-green-400/70">active</span>
                          </div>
                        )}
                      </div>
                      {i === active && (
                        <div className="ml-auto w-0.5 rounded-full self-stretch" style={{ background: agent.color.accent, opacity: 0.6 }} />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Detail panel */}
              <div
                className="flex-1 p-5 flex flex-col gap-4 transition-all duration-150"
                style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(4px)' : 'translateY(0)' }}
              >
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: agent.color.chip, border: `1px solid ${agent.color.border}` }}
                  >
                    <ActiveIcon className="w-4 h-4" style={{ color: agent.color.accent }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/85 font-bold text-sm">{agent.name}</span>
                      <span
                        className="text-[9px] font-semibold px-2 py-0.5 rounded-full border"
                        style={{ background: agent.color.chip, color: agent.color.text, borderColor: agent.color.border }}
                      >
                        {agent.traits[0]}
                      </span>
                    </div>
                    <p className="text-white/35 text-[11px]">{agent.tagline}</p>
                  </div>
                </div>

                <p className="text-white/45 text-[12px] leading-relaxed">{agent.description}</p>

                {/* Capabilities */}
                <div className="space-y-2">
                  {agent.capabilities.map(cap => (
                    <div key={cap} className="flex items-start gap-2">
                      <span className="text-[9px] mt-[3px] shrink-0" style={{ color: agent.color.accent }}>✦</span>
                      <span className="text-white/55 text-[11px] leading-snug">{cap}</span>
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 rounded-xl overflow-hidden border mt-auto" style={{ borderColor: agent.color.border }}>
                  {agent.stats.map((s, i) => (
                    <div
                      key={s.label}
                      className={`px-3 py-2.5 ${i < agent.stats.length - 1 ? 'border-r' : ''}`}
                      style={{ background: agent.color.chip, borderColor: agent.color.border }}
                    >
                      <div className="text-[9px] text-white/25 uppercase tracking-widest mb-0.5">{s.label}</div>
                      <div className="text-[11px] font-bold" style={{ color: agent.color.text }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
