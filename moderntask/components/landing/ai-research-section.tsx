'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type Phase = 'profile' | 'article' | 'email' | 'done'

const EMAIL_BODY = `Hi Sarah,

Saw ScaleFlow just closed a $12M Series A and you're scaling the SDR team for the US push. That usually means outbound volume becomes the constraint before headcount catches up.

Meridian researches every prospect before writing, so each email references real context — not {{first_name}} and a generic pitch.

Worth 15 minutes to see how it fits?

Alex`

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export function AiResearchSection() {
  const [phase, setPhase]   = useState<Phase>('profile')
  const [scanY, setScanY]   = useState(-5)
  const [typed, setTyped]   = useState(0)
  const alive = useRef(true)

  // Trigger scan bar sweep on phase change
  useEffect(() => {
    if (phase !== 'profile' && phase !== 'article') return
    setScanY(-5)
    const t = setTimeout(() => { if (alive.current) setScanY(115) }, 60)
    return () => clearTimeout(t)
  }, [phase])

  // Main animation sequence
  useEffect(() => {
    alive.current = true
    let typeTimer: ReturnType<typeof setInterval> | null = null

    const run = async () => {
      setPhase('profile')
      setTyped(0)
      await sleep(3600)
      if (!alive.current) return

      setPhase('article')
      await sleep(3600)
      if (!alive.current) return

      setPhase('email')
      setTyped(0)
      typeTimer = setInterval(() => {
        setTyped(n => {
          if (n >= EMAIL_BODY.length) { clearInterval(typeTimer!); return n }
          return n + 1
        })
      }, 22)
      await sleep(EMAIL_BODY.length * 22 + 600)
      if (typeTimer) { clearInterval(typeTimer); typeTimer = null }
      if (!alive.current) return

      setPhase('done')
      await sleep(2800)
      if (!alive.current) return

      run()
    }

    run()
    return () => {
      alive.current = false
      if (typeTimer) clearInterval(typeTimer)
    }
  }, [])

  const activeTab = phase === 'done' ? 'email' : phase

  const statusLabel = {
    profile: 'Scanning profile…',
    article: 'Reading signals…',
    email:   'Drafting email…',
    done:    'Ready to send',
  }[phase]

  return (
    <section className="relative z-10 min-h-screen flex items-center px-8 sm:px-16 py-28">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 xl:gap-24 items-center">

        {/* ── Left: copy ── */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            How it works
          </div>

          <h2 className="text-4xl sm:text-5xl xl:text-6xl font-black text-white leading-[1.04] tracking-tight mb-5">
            Reads the room<br />before writing.
          </h2>

          <p className="text-white/50 text-lg leading-relaxed mb-8 max-w-[420px]">
            Every email starts with account intelligence. Meridian pulls company profiles, recent news, hiring signals, and role context — then writes from that research. Not a template.
          </p>

          <div className="space-y-3 mb-10">
            {[
              'Company profile and role intelligence',
              'Funding rounds and hiring signals',
              'Recent news and LinkedIn activity',
              'Tech stack and buyer intent data',
            ].map(item => (
              <div key={item} className="flex items-center gap-3 text-white/55 text-[15px]">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                {item}
              </div>
            ))}
          </div>

          <Link
            href="/signin"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105"
          >
            Start free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* ── Right: browser window ── */}
        <div className="rounded-2xl border border-white/[0.10] bg-[#07091c]/90 backdrop-blur-2xl overflow-hidden shadow-2xl shadow-black/70 ring-1 ring-white/[0.04]">

          {/* Title bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex gap-1.5 shrink-0">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 px-3 py-[3px] rounded bg-white/[0.05] border border-white/[0.06] text-white/20 text-[10px] font-mono text-center truncate">
              {activeTab === 'profile' && 'linkedin.com/company/scaleflow'}
              {activeTab === 'article' && 'techcrunch.com · ScaleFlow raises $12M Series A'}
              {activeTab === 'email'   && 'mail.google.com · New Message'}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-[10px] text-indigo-400/80 font-medium whitespace-nowrap">{statusLabel}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex text-[11px] border-b border-white/[0.06] bg-black/10">
            {[
              { id: 'profile', label: 'ScaleFlow · LinkedIn' },
              { id: 'article', label: 'TechCrunch · Series A' },
              { id: 'email',   label: '✉ New Message' },
            ].map(tab => (
              <div
                key={tab.id}
                className={`px-4 py-2 border-r border-white/[0.04] whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-white/80 bg-white/[0.05] border-b-2 border-b-indigo-500'
                    : 'text-white/20'
                }`}
              >
                {tab.label}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="relative min-h-[420px] overflow-hidden">

            {/* Scanning highlight */}
            {(phase === 'profile' || phase === 'article') && (
              <div
                className="absolute inset-x-0 h-12 pointer-events-none z-20"
                style={{
                  top: `${scanY}%`,
                  background: 'linear-gradient(to bottom, transparent, rgba(99,102,241,0.09), transparent)',
                  transform: 'translateY(-50%)',
                  transition: 'top 3.2s linear',
                }}
              />
            )}

            <div className="p-5">

              {/* ── Profile ── */}
              {phase === 'profile' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-sm shrink-0">SF</div>
                    <div>
                      <div className="text-white/85 font-bold text-sm">ScaleFlow</div>
                      <div className="text-white/30 text-[11px]">Software Development · 47 employees · San Francisco, CA</div>
                      <div className="flex gap-1.5 mt-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20">Series A</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">B2B SaaS</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/20">RevOps</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-1.5">About</div>
                    <div className="text-[12px] text-white/50 leading-relaxed">AI-powered revenue platform helping B2B teams scale outbound without adding headcount. Trusted by 200+ fast-growing companies.</div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">Key People</div>
                    <div className="space-y-1.5">
                      {[{ n: 'Sarah Chen', r: 'Head of Growth' }, { n: 'Marcus Lee', r: 'VP of Sales' }].map(p => (
                        <div key={p.n} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-[9px] font-bold">{p.n[0]}</div>
                          <span className="text-[12px] text-white/60 font-medium">{p.n}</span>
                          <span className="text-[11px] text-white/25">· {p.r}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">Recent Activity</div>
                    <div className="space-y-2">
                      {[
                        { e: '📢', t: 'Hiring 3 Senior SDRs — US enterprise expansion', d: '2d' },
                        { e: '📝', t: 'Our outbound playbook for Series A companies', d: '1w' },
                        { e: '🚀', t: 'ScaleFlow reaches 340% ARR growth in Q4', d: '2w' },
                      ].map((a, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs shrink-0 mt-px">{a.e}</span>
                          <span className="text-[11px] text-white/38 leading-relaxed flex-1">{a.t}</span>
                          <span className="text-[10px] text-white/18 shrink-0">{a.d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Article ── */}
              {phase === 'article' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white/85 bg-white/10 px-2 py-0.5 rounded">TechCrunch</span>
                    <span className="text-[10px] text-white/25">· 3 days ago</span>
                  </div>
                  <h3 className="text-white/85 font-bold text-[15px] leading-snug">
                    ScaleFlow raises $12M Series A to triple US outbound sales capacity
                  </h3>
                  <div className="space-y-2.5 text-[12px] text-white/42 leading-relaxed">
                    <p>The San Francisco startup plans to expand its go-to-market team from 12 to 35 by Q3, with a focus on enterprise outbound and a new SDR motion targeting mid-market accounts.</p>
                    <div className="border-l-2 border-indigo-500/50 pl-3">
                      <p className="text-white/62 italic">
                        "We're not buying another point solution," said{' '}
                        <span className="text-indigo-300 font-semibold not-italic">Sarah Chen, Head of Growth</span>.
                        {' '}"We need the outbound to actually work at scale."
                      </p>
                    </div>
                    <p>The raise follows a strong Q4 — 340% ARR growth — and signals an aggressive push into mid-market before year-end.</p>
                    <p className="text-white/20">Investors include Sequoia, Y Combinator, and several prominent angels from the revenue intelligence space…</p>
                  </div>
                </div>
              )}

              {/* ── Email ── */}
              {(phase === 'email' || phase === 'done') && (
                <div>
                  <div className="border-b border-white/[0.06] pb-3 mb-4 space-y-1.5">
                    {[
                      { l: 'From',    v: 'alex@yourcompany.com',  c: 'text-white/50' },
                      { l: 'To',      v: 'sarah@scaleflow.io',    c: 'text-indigo-400' },
                      { l: 'Subject', v: "ScaleFlow's SDR expansion", c: 'text-white/65' },
                    ].map(f => (
                      <div key={f.l} className="flex items-center gap-3 text-[11px]">
                        <span className="text-white/22 w-12 text-right shrink-0">{f.l}</span>
                        <span className={`font-medium ${f.c}`}>{f.v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[12px] text-white/60 leading-relaxed whitespace-pre-wrap font-mono">
                    {phase === 'done' ? EMAIL_BODY : EMAIL_BODY.slice(0, typed)}
                    {phase === 'email' && typed < EMAIL_BODY.length && (
                      <span className="inline-block w-px h-[13px] bg-indigo-400 animate-pulse align-text-bottom ml-px" />
                    )}
                  </div>

                  {phase === 'done' && (
                    <div className="mt-5 flex items-center gap-3">
                      <button className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-[12px] font-semibold rounded-lg hover:bg-indigo-500 transition-colors">
                        Send <ArrowRight className="w-3 h-3" />
                      </button>
                      <span className="text-[11px] text-green-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Email ready
                      </span>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
