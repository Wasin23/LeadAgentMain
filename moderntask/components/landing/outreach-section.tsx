'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

// ── animated email feed ───────────────────────────────────────────────────────
const EMAILS = [
  { to: 'Jake Torres',    co: 'ScaleFlow',   sub: 'Re: outbound tooling',      tag: 'replied',  delay: 0    },
  { to: 'Priya Shah',     co: 'Finova',      sub: 'Quick question for you',     tag: 'sent',     delay: 600  },
  { to: 'Carlos Reyes',   co: 'FleetGrid',   sub: 'Saw your Series A news',     tag: 'opened',   delay: 1200 },
  { to: 'Mia Chen',       co: 'LayerStack',  sub: 'Following up from last week', tag: 'sent',    delay: 1800 },
  { to: 'Derek Mills',    co: 'StitchOps',   sub: 'Intro to Meridian',          tag: 'sent',     delay: 2400 },
  { to: 'Lisa Park',      co: 'Driftwork',   sub: 'Re: scaling your outbound',  tag: 'replied',  delay: 3000 },
  { to: 'James Whitfield','co': 'NexaCloud', sub: 'Personalized note for you',  tag: 'opened',   delay: 3600 },
]

const TAG_STYLE: Record<string, string> = {
  sent:    'bg-indigo-50 text-indigo-500 border border-indigo-100',
  opened:  'bg-amber-50 text-amber-600 border border-amber-100',
  replied: 'bg-green-50 text-green-600 border border-green-200',
}

const INITIALS: Record<string, string> = {
  'Jake Torres': 'JT', 'Priya Shah': 'PS', 'Carlos Reyes': 'CR',
  'Mia Chen': 'MC', 'Derek Mills': 'DM', 'Lisa Park': 'LP', 'James Whitfield': 'JW',
}

const HUE: Record<string, string> = {
  'Jake Torres': '#6366f1', 'Priya Shah': '#8b5cf6', 'Carlos Reyes': '#0ea5e9',
  'Mia Chen': '#f59e0b',   'Derek Mills': '#10b981', 'Lisa Park': '#ec4899', 'James Whitfield': '#6366f1',
}

function EmailFeed() {
  const [visible, setVisible] = useState<boolean[]>(() => Array(EMAILS.length).fill(false))

  useEffect(() => {
    const timers = EMAILS.map((e, i) =>
      setTimeout(() => setVisible(v => { const n = [...v]; n[i] = true; return n }), e.delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* header bar */}
      <div className="card-premium rounded-2xl overflow-hidden bg-white/90 backdrop-blur-sm border border-black/[0.06]" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-300" />
          </div>
          <span className="text-[11px] text-black/30 font-mono ml-2">meridian · outbox</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-green-500/80 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            live
          </span>
        </div>

        {/* stat row */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          {[['Sent', '1,847'], ['Opened', '61%'], ['Replied', '12%']].map(([label, val]) => (
            <div key={label} className="py-3 text-center">
              <div className="text-[15px] font-black text-gray-900">{val}</div>
              <div className="text-[10px] text-black/30 uppercase tracking-widest">{label}</div>
            </div>
          ))}
        </div>

        {/* email rows */}
        <div className="divide-y divide-gray-50">
          {EMAILS.map((e, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 transition-all duration-500"
              style={{
                opacity: visible[i] ? 1 : 0,
                transform: visible[i] ? 'translateY(0)' : 'translateY(8px)',
              }}
            >
              {/* avatar */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: HUE[e.to] }}
              >
                {INITIALS[e.to]}
              </div>

              {/* body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold text-gray-900 truncate">{e.to}</span>
                  <span className="text-[10px] text-black/25 truncate shrink-0">· {e.co}</span>
                </div>
                <div className="text-[11px] text-black/40 truncate">{e.sub}</div>
              </div>

              {/* tag */}
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${TAG_STYLE[e.tag]}`}>
                {e.tag}
              </span>
            </div>
          ))}
        </div>

        {/* typing indicator */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          <span className="text-[11px] text-black/25">agent is writing next batch…</span>
        </div>
      </div>
    </div>
  )
}

// ── section ───────────────────────────────────────────────────────────────────
export function OutreachSection() {
  return (
    <section className="relative z-10 h-full overflow-hidden">

      <div className="relative z-10 h-full flex items-center">
        <div className="w-full max-w-7xl mx-auto px-6 sm:px-12">
          <div className="flex flex-col lg:flex-row items-center gap-16">

            {/* left copy */}
            <div className="flex-1 max-w-[440px] shrink-0">
              <p className="enter-0 text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-4">Outreach</p>
              <h2 className="enter-1 text-5xl xl:text-6xl font-black text-gray-900 leading-[1.05] tracking-tight mb-6">
                Sends. Tracks.<br />Follows up.
              </h2>
              <p className="enter-2 text-black/50 text-lg leading-relaxed mb-8">
                Every email fires from your real inbox. Opens get tracked, follow-ups go out automatically, and the moment someone replies, all sequences stop instantly.
              </p>
              <div className="enter-3 space-y-3 mb-10">
                {[
                  'Sends from Gmail or Outlook, your real domain',
                  'Open and click tracking per email',
                  'Smart follow-ups: pause on reply, resume on silence',
                  'Every reply routes back to your inbox',
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-black/55 text-[15px]">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <Link
                href="/signin"
                className="enter-4 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105"
              >
                Start free
              </Link>
            </div>

            {/* right: email feed */}
            <div className="enter-5 flex-1 w-full min-w-0 flex items-center justify-center">
              <EmailFeed />
            </div>

          </div>
        </div>
      </div>

    </section>
  )
}
