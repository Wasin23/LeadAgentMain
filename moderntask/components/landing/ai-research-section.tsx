'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type Phase = 'database' | 'linkedin' | 'websearch' | 'article' | 'email' | 'done'

const EMAIL_BODY = `Hi Sarah,

Saw ScaleFlow just closed $12M and you're scaling the SDR team. That usually means outbound becomes the bottleneck before headcount catches up.

Meridian researches every prospect first — so the email references real context, not a template.

Worth 15 minutes?

Alex`

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

// Word-by-word scanning component
function ScanText({ text, speed = 14 }: { text: string; speed?: number }) {
  const [idx, setIdx] = useState(0)
  const words = useMemo(() => text.split(' '), [text])

  useEffect(() => {
    setIdx(0)
    let i = 0
    const t = setInterval(() => {
      i++
      setIdx(i)
      if (i >= words.length) clearInterval(t)
    }, 1000 / speed)
    return () => clearInterval(t)
  }, [text, speed, words.length])

  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          <span className={
            i < idx  ? 'text-white/62' :
            i === idx ? 'bg-indigo-500/30 text-white/90 rounded-sm px-0.5' :
            'text-white/18'
          }>
            {word}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  )
}

export function AiResearchSection() {
  const [phase, setPhase]     = useState<Phase>('database')
  const [subStep, setSubStep] = useState(0)
  const [barPct, setBarPct]   = useState(0)
  const [typed, setTyped]     = useState(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    let typeTimer: ReturnType<typeof setInterval> | null = null

    const run = async () => {
      // ── Database ──────────────────────────────────────
      setPhase('database')
      setSubStep(0)
      setBarPct(0)
      setTyped(0)
      await sleep(500)
      if (!alive.current) return

      setSubStep(1) // show progress bar
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (alive.current) setBarPct(100)
      }))
      await sleep(1400)
      if (!alive.current) return

      setSubStep(2) // show results
      await sleep(700)
      if (!alive.current) return

      setSubStep(3) // highlight top match
      await sleep(600)
      if (!alive.current) return

      // ── LinkedIn ──────────────────────────────────────
      setPhase('linkedin')
      setSubStep(0)
      await sleep(3200)
      if (!alive.current) return

      // ── Web search ────────────────────────────────────
      setPhase('websearch')
      setSubStep(0)
      await sleep(400)
      if (!alive.current) return
      setSubStep(1) // results appear
      await sleep(700)
      if (!alive.current) return
      setSubStep(2) // highlight first result
      await sleep(900)
      if (!alive.current) return

      // ── Article ───────────────────────────────────────
      setPhase('article')
      setSubStep(0)
      await sleep(3200)
      if (!alive.current) return

      // ── Email typing ──────────────────────────────────
      setPhase('email')
      setTyped(0)
      typeTimer = setInterval(() => {
        setTyped(n => {
          if (n >= EMAIL_BODY.length) { clearInterval(typeTimer!); return n }
          return n + 1
        })
      }, 22)
      await sleep(EMAIL_BODY.length * 22 + 400)
      if (typeTimer) { clearInterval(typeTimer); typeTimer = null }
      if (!alive.current) return

      // ── Done ──────────────────────────────────────────
      setPhase('done')
      await sleep(2500)
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

  const TAB_LABELS: Record<Phase, string> = {
    database:  '⬡ Prospect Engine',
    linkedin:  'ScaleFlow · LinkedIn',
    websearch: 'Google',
    article:   'TechCrunch · Series A',
    email:     '✉ New Message',
    done:      '✉ New Message',
  }

  const URL_LABELS: Record<Phase, string> = {
    database:  'meridian://prospect-engine/search',
    linkedin:  'linkedin.com/company/scaleflow',
    websearch: 'google.com/search?q=ScaleFlow+funding+2024',
    article:   'techcrunch.com · ScaleFlow raises $12M Series A',
    email:     'mail.google.com · New Message',
    done:      'mail.google.com · New Message',
  }

  const STATUS_LABELS: Record<Phase, string> = {
    database:  'Searching ICP database…',
    linkedin:  'Scanning profile…',
    websearch: 'Finding signals…',
    article:   'Reading article…',
    email:     'Drafting email…',
    done:      'Ready to send',
  }

  return (
    <section className="relative z-10 min-h-screen flex items-center px-8 sm:px-16 py-28">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 xl:gap-24 items-center">

        {/* ── Left copy ── */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            How it works
          </div>

          <h2 className="text-4xl sm:text-5xl xl:text-6xl font-black text-white leading-[1.04] tracking-tight mb-5">
            Reads the room<br />before writing.
          </h2>

          <p className="text-white/50 text-lg leading-relaxed mb-3 max-w-[420px]">
            Every email starts with account intelligence. Meridian pulls company profiles, recent news, hiring signals, and role context — then writes from that research. Not a template.
          </p>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/55 text-sm mb-8">
            <span className="text-green-400">⚡</span>
            Average research + email: <span className="text-white/80 font-semibold">~10 seconds</span>
          </div>

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
              {URL_LABELS[activeTab]}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${phase === 'done' ? 'bg-green-400' : 'bg-indigo-400 animate-pulse'}`} />
              <span className={`text-[10px] font-medium whitespace-nowrap ${phase === 'done' ? 'text-green-400' : 'text-indigo-400/80'}`}>
                {STATUS_LABELS[phase]}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex text-[11px] border-b border-white/[0.06] bg-black/10 overflow-x-auto">
            {(['database', 'linkedin', 'websearch', 'article', 'email'] as Phase[]).map(tab => (
              <div
                key={tab}
                className={`px-3 py-2 border-r border-white/[0.04] whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === tab
                    ? 'text-white/80 bg-white/[0.05] border-b-2 border-b-indigo-500'
                    : 'text-white/18'
                }`}
              >
                {TAB_LABELS[tab]}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="min-h-[420px] p-5 overflow-hidden">

            {/* ── Database ── */}
            {phase === 'database' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">ICP Filter Active</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">Running</span>
                </div>

                <div className="space-y-1.5 text-[12px]">
                  {[
                    ['Industry',     'B2B SaaS, RevOps, GTM'],
                    ['Company size', '11 – 500 employees'],
                    ['Funding',      'Series A – C'],
                    ['Seniority',    'VP+, Head of, Director'],
                    ['Geography',    'North America, Europe'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-green-400 text-[10px]">✓</span>
                      <span className="text-white/30 w-24 shrink-0">{k}</span>
                      <span className="text-white/60 font-medium">{v}</span>
                    </div>
                  ))}
                </div>

                {subStep >= 1 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-white/30">
                      <span>Scanning 50,234,891 companies</span>
                      <span className="text-indigo-400">{subStep >= 2 ? '100%' : '…'}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${barPct}%`, transition: 'width 1.3s ease-out' }}
                      />
                    </div>
                  </div>
                )}

                {subStep >= 2 && (
                  <div className="space-y-1.5 text-[12px] border-t border-white/[0.06] pt-3">
                    <div className="flex items-center gap-2 text-white/40">
                      <span className="text-green-400">✓</span>
                      <span>12,441 initial matches found</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/40">
                      <span className="text-green-400">✓</span>
                      <span>1,203 passed intent signal filters</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/55 font-medium">
                      <span className="text-indigo-400">→</span>
                      <span>8 high-fit leads selected for outreach</span>
                    </div>
                  </div>
                )}

                {subStep >= 3 && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/25 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-[10px] font-bold shrink-0">SC</div>
                    <div>
                      <div className="text-[12px] text-white/80 font-semibold">Sarah Chen · Head of Growth</div>
                      <div className="text-[10px] text-white/35">ScaleFlow · San Francisco · Series A</div>
                    </div>
                    <span className="ml-auto text-indigo-400 text-[11px] font-medium">Top match →</span>
                  </div>
                )}
              </div>
            )}

            {/* ── LinkedIn ── */}
            {phase === 'linkedin' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-sm shrink-0">SF</div>
                  <div>
                    <div className="text-white/85 font-bold text-sm">ScaleFlow</div>
                    <div className="text-white/30 text-[11px]">Software Development · 47 employees · San Francisco, CA</div>
                    <div className="flex gap-1.5 mt-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20">Series A</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">B2B SaaS</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-1.5">About</div>
                  <div className="text-[12px] leading-relaxed">
                    <ScanText
                      text="AI-powered revenue platform helping B2B teams scale outbound without adding headcount. Trusted by 200+ fast-growing companies across North America and Europe."
                      speed={12}
                    />
                  </div>
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
                        <span className="text-[11px] leading-relaxed flex-1">
                          <ScanText text={a.t} speed={10} />
                        </span>
                        <span className="text-[10px] text-white/18 shrink-0">{a.d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Web search ── */}
            {phase === 'websearch' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-[12px]">
                  <span className="text-white/30">🔍</span>
                  <span className="text-white/55">ScaleFlow funding news 2024</span>
                </div>
                <div className="text-[10px] text-white/25">About 4,820 results (0.38 seconds)</div>

                {subStep >= 1 && (
                  <div className="space-y-3">
                    {[
                      {
                        source: 'TechCrunch',
                        url:    'techcrunch.com › 2024 › scaleflow-series-a',
                        title:  'ScaleFlow raises $12M Series A to triple US outbound sales capacity',
                        snippet:'The San Francisco startup plans to expand its go-to-market team and scale enterprise outbound…',
                        highlight: true,
                      },
                      {
                        source: 'Forbes',
                        url:    'forbes.com › startups › 2024',
                        title:  'Top RevOps startups to watch in 2024',
                        snippet:'ScaleFlow among companies reshaping how B2B teams approach outbound sales automation…',
                        highlight: false,
                      },
                      {
                        source: 'VentureBeat',
                        url:    'venturebeat.com › ai',
                        title:  'ScaleFlow named top 50 AI startups by VentureBeat',
                        snippet:'Recognition follows strong Q4 performance with 340% ARR growth reported…',
                        highlight: false,
                      },
                    ].map((r, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl transition-all ${
                          subStep >= 2 && r.highlight
                            ? 'bg-indigo-500/10 border border-indigo-500/25'
                            : 'border border-transparent'
                        }`}
                      >
                        <div className="text-[10px] text-green-400/70 mb-0.5">{r.url}</div>
                        <div className={`text-[13px] font-semibold mb-1 leading-snug ${subStep >= 2 && r.highlight ? 'text-indigo-300' : 'text-white/55'}`}>
                          {r.title}
                        </div>
                        <div className="text-[11px] text-white/30 leading-relaxed">{r.snippet}</div>
                      </div>
                    ))}
                  </div>
                )}
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
                <div className="space-y-2.5 text-[12px] leading-relaxed">
                  <p>
                    <ScanText
                      text="The San Francisco startup plans to expand its go-to-market team from 12 to 35 by Q3, with a focus on enterprise outbound and a new SDR motion targeting mid-market accounts."
                      speed={11}
                    />
                  </p>
                  <div className="border-l-2 border-indigo-500/50 pl-3">
                    <p>
                      <ScanText
                        text={`"We're not buying another point solution," said Sarah Chen, Head of Growth. "We need the outbound to actually work at scale."`}
                        speed={11}
                      />
                    </p>
                  </div>
                  <p>
                    <ScanText
                      text="The raise follows a strong Q4 — 340% ARR growth — and signals an aggressive push into mid-market before year-end. Investors include Sequoia and Y Combinator."
                      speed={11}
                    />
                  </p>
                </div>
              </div>
            )}

            {/* ── Email ── */}
            {(phase === 'email' || phase === 'done') && (
              <div>
                <div className="border-b border-white/[0.06] pb-3 mb-4 space-y-1.5">
                  {[
                    { l: 'From',    v: 'alex@yourcompany.com',    c: 'text-white/45' },
                    { l: 'To',      v: 'sarah@scaleflow.io',      c: 'text-indigo-400' },
                    { l: 'Subject', v: "ScaleFlow's SDR expansion", c: 'text-white/65' },
                  ].map(f => (
                    <div key={f.l} className="flex items-center gap-3 text-[11px]">
                      <span className="text-white/20 w-12 text-right shrink-0">{f.l}</span>
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
    </section>
  )
}
