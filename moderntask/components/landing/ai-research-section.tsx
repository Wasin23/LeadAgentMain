'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type Phase = 'database' | 'linkedin' | 'websearch' | 'article' | 'email' | 'done'

const EMAIL_BODY = `Hi Sarah,

Saw ScaleFlow just closed $12M Series A and you're scaling the team from 12 to 35 by Q3. That usually means outbound volume becomes the bottleneck right as the board starts expecting pipeline numbers.

The SDR expansion is the tell — you need those reps producing fast, not spending the first 60 days building a prospecting workflow from scratch.

Meridian runs an AI agent that sources leads, researches each account, and writes the email from real context — funding news, hiring signals, the exact role. Your SDRs hit the ground with a full sequence already running.

Worth 15 minutes to see how it fits the Q3 push?

Alex`

const ARTICLE_PARAS = [
  "ScaleFlow, the San Francisco-based revenue intelligence platform, announced today a $12M Series A led by Sequoia Capital, with participation from Y Combinator and a group of strategic angels with backgrounds in enterprise GTM and outbound sales infrastructure.",
  "The raise will fund an aggressive US expansion — growing the go-to-market team from 12 to 35 by Q3, with the first hiring wave focused entirely on outbound sales infrastructure, enterprise account executives, and solutions engineers who can run complex mid-market deals.",
  "The company is actively recruiting three Senior SDRs to anchor its new enterprise outbound motion, targeting accounts with 50 to 500 employees across North America and Western Europe, with a particular focus on B2B SaaS and services companies scaling their revenue org.",
  `"We're not buying another point solution," said Sarah Chen, Head of Growth at ScaleFlow. "We need outbound that actually works at scale — something that researches the account, writes a real email, and doesn't require someone babysitting every sequence all day."`,
  "The funding follows a breakout Q4 — 340% ARR growth driven by expansion into the US enterprise segment and a new reseller channel across Northern Europe. The company now serves over 200 revenue teams in 18 countries, up from 60 at the start of the year.",
  "ScaleFlow's platform automates the full outbound loop: prospect sourcing, personalized email generation, follow-up sequencing, and reply routing — all orchestrated by a single AI workflow per campaign, with no manual handoffs between steps.",
  "Investors point to the $14B sales engagement market as the core opportunity, noting that most B2B teams still rely on manual prospecting and generic blast templates that consistently underperform compared to research-backed personalized outreach.",
]

const PARA_NOTES: string[] = [
  '$12M Series A · Sequoia + YC',
  'Team: 12 → 35 by Q3 · AEs + solutions engineers',
  'Actively hiring 3 Senior SDRs (enterprise focus)',
  '"Need outbound that works at scale" — Sarah Chen, HoG',
  '340% ARR Q4 · 200+ customers · 18 countries',
  '',
  '$14B market · personalization gap confirmed by investors',
]

const WPS = 70

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

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
            i < idx   ? 'text-white/62' :
            i === idx ? 'bg-indigo-500/30 text-white/90 rounded-sm px-0.5' :
            'text-white/18'
          }>{word}</span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  )
}

function ArticlePara({
  text,
  state,
  setRef,
}: {
  text: string
  state: 'past' | 'current' | 'future'
  setRef: (el: HTMLParagraphElement | null) => void
}) {
  const [idx, setIdx] = useState(0)
  const words = useMemo(() => text.split(' '), [text])

  useEffect(() => {
    if (state !== 'current') {
      setIdx(state === 'past' ? words.length + 1 : 0)
      return
    }
    setIdx(0)
    let i = 0
    const t = setInterval(() => {
      i++
      setIdx(i)
      if (i >= words.length) clearInterval(t)
    }, 1000 / WPS)
    return () => clearInterval(t)
  }, [state, words.length])

  return (
    <p
      ref={setRef}
      className={`text-[12px] leading-[1.75] transition-opacity duration-500 ${state === 'future' ? 'opacity-20' : 'opacity-100'}`}
    >
      {state === 'past' ? (
        <span className="text-white/58">{text}</span>
      ) : state === 'future' ? (
        <span className="text-white/50">{text}</span>
      ) : (
        words.map((word, i) => (
          <span key={i}>
            <span className={
              i < idx   ? 'text-white/62' :
              i === idx ? 'bg-indigo-500/30 text-white/92 rounded-sm px-0.5' :
              'text-white/18'
            }>{word}</span>
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))
      )}
    </p>
  )
}

export function AiResearchSection() {
  const [phase, setPhase]         = useState<Phase>('database')
  const [subStep, setSubStep]     = useState(0)
  const [barPct, setBarPct]       = useState(0)
  const [typed, setTyped]         = useState(0)
  const [artPara, setArtPara]     = useState(0)
  const [notesList, setNotesList] = useState<string[]>([])
  const alive                     = useRef(true)

  const articleScrollRef = useRef<HTMLDivElement>(null)
  const paraElems        = useRef<(HTMLParagraphElement | null)[]>(Array(ARTICLE_PARAS.length).fill(null))

  useEffect(() => {
    if (phase !== 'article') return
    const el        = paraElems.current[artPara]
    const container = articleScrollRef.current
    if (!el || !container) return
    container.scrollTo({ top: Math.max(0, el.offsetTop - 32), behavior: 'smooth' })
  }, [artPara, phase])

  useEffect(() => {
    alive.current = true
    let typeTimer: ReturnType<typeof setInterval> | null = null

    const run = async () => {
      setPhase('database'); setSubStep(0); setBarPct(0); setTyped(0); setArtPara(0); setNotesList([])
      await sleep(500); if (!alive.current) return

      setSubStep(1)
      requestAnimationFrame(() => requestAnimationFrame(() => { if (alive.current) setBarPct(100) }))
      await sleep(1400); if (!alive.current) return

      setSubStep(2); await sleep(700); if (!alive.current) return
      setSubStep(3); await sleep(700); if (!alive.current) return

      setPhase('linkedin'); setSubStep(0)
      await sleep(1200); if (!alive.current) return

      setPhase('websearch'); setSubStep(0)
      await sleep(150);  if (!alive.current) return
      setSubStep(1); await sleep(350);  if (!alive.current) return
      setSubStep(2); await sleep(500); if (!alive.current) return

      setPhase('article'); setArtPara(0); setNotesList([])
      for (let i = 0; i < ARTICLE_PARAS.length; i++) {
        if (!alive.current) return
        setArtPara(i)
        const dur = Math.ceil(ARTICLE_PARAS[i].split(' ').length / WPS) * 1000 + 60
        await sleep(dur)
        if (!alive.current) return
        if (PARA_NOTES[i]) setNotesList(n => [...n, PARA_NOTES[i]])
      }
      if (!alive.current) return

      setPhase('email'); setTyped(0)
      typeTimer = setInterval(() => {
        setTyped(n => {
          if (n >= EMAIL_BODY.length) { clearInterval(typeTimer!); return n }
          return n + 1
        })
      }, 14)
      await sleep(EMAIL_BODY.length * 14 + 500)
      if (typeTimer) { clearInterval(typeTimer); typeTimer = null }
      if (!alive.current) return

      setPhase('done')
      await sleep(3000); if (!alive.current) return
      run()
    }

    run()
    return () => { alive.current = false; if (typeTimer) clearInterval(typeTimer) }
  }, [])

  const activeTab = phase === 'done' ? 'email' : phase
  const showSplit = phase === 'article' || phase === 'email' || phase === 'done'

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
    websearch: 'google.com/search?q=ScaleFlow+Series+A+funding',
    article:   'techcrunch.com › 2024 › scaleflow-raises-12m-series-a',
    email:     'mail.google.com · Compose',
    done:      'mail.google.com · Compose',
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
    <section className="relative z-10 min-h-screen flex items-center px-6 sm:px-10 py-32">
      <style>{`
        @keyframes noteSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .note-item { animation: noteSlideIn 0.35s ease-out forwards; }
      `}</style>

      <div className="max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-14 xl:gap-20 items-start">

        {/* ── Left copy ── */}
        <div className="lg:sticky lg:top-28">
          <h2 className="text-4xl sm:text-5xl xl:text-[3.25rem] font-black text-white leading-[1.04] tracking-tight mb-5">
            Reads the room<br />before writing.
          </h2>

          <p className="text-white/50 text-lg leading-relaxed mb-4 max-w-[400px]">
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

        {/* ── Browser window ── */}
        <div className="rounded-2xl border border-white/[0.10] bg-[#07091c]/90 backdrop-blur-2xl overflow-hidden shadow-2xl shadow-black/70 ring-1 ring-white/[0.04]">

          {/* Title bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
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
                className={`px-3.5 py-2.5 border-r border-white/[0.04] whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === tab
                    ? 'text-white/80 bg-white/[0.05] border-b-2 border-b-indigo-500'
                    : 'text-white/18'
                }`}
              >
                {TAB_LABELS[tab]}
              </div>
            ))}
          </div>

          {/* Content pane — splits into article + notes during article/email/done */}
          <div className={showSplit ? 'flex h-[660px]' : 'min-h-[560px] p-6 overflow-y-auto'}>

            {/* Main scrollable area */}
            <div
              ref={articleScrollRef}
              className={`overflow-y-auto ${showSplit ? 'flex-1 p-6 border-r border-white/[0.06]' : 'w-full'}`}
            >

              {/* ── DATABASE ── */}
              {phase === 'database' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">ICP Filter Active</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">Running</span>
                  </div>

                  <div className="space-y-2 text-[12px]">
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
                    <div className="space-y-2">
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
                    <div className="space-y-2 text-[12px] border-t border-white/[0.06] pt-4">
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
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/25 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-[10px] font-bold shrink-0">SC</div>
                      <div>
                        <div className="text-[13px] text-white/80 font-semibold">Sarah Chen · Head of Growth</div>
                        <div className="text-[11px] text-white/35">ScaleFlow · San Francisco · Series A</div>
                      </div>
                      <span className="ml-auto text-indigo-400 text-[11px] font-medium whitespace-nowrap">Top match →</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── LINKEDIN ── */}
              {phase === 'linkedin' && (
                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-sm shrink-0">SF</div>
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
                        speed={70}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">Key People</div>
                    <div className="space-y-2">
                      {[
                        { n: 'Sarah Chen',  r: 'Head of Growth' },
                        { n: 'Marcus Lee',  r: 'VP of Sales' },
                        { n: 'Priya Nair',  r: 'Director of Revenue Ops' },
                      ].map(p => (
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
                    <div className="space-y-2.5">
                      {[
                        { e: '📢', t: 'Hiring 3 Senior SDRs — US enterprise expansion', d: '2d' },
                        { e: '📝', t: 'Our outbound playbook for post-Series A companies', d: '5d' },
                        { e: '🚀', t: 'ScaleFlow reaches 340% ARR growth in Q4', d: '2w' },
                        { e: '🌍', t: 'Expanding into EMEA — new reseller partnerships signed', d: '3w' },
                      ].map((a, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs shrink-0 mt-px">{a.e}</span>
                          <span className="text-[11px] leading-relaxed flex-1">
                            <ScanText text={a.t} speed={70} />
                          </span>
                          <span className="text-[10px] text-white/18 shrink-0">{a.d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── WEB SEARCH ── */}
              {phase === 'websearch' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/[0.05] border border-white/[0.08] text-[12px]">
                    <span className="text-white/30">🔍</span>
                    <span className="text-white/55">ScaleFlow Series A funding 2024</span>
                  </div>
                  <div className="text-[10px] text-white/25">About 8,420 results (0.31 seconds)</div>

                  {subStep >= 1 && (
                    <div className="space-y-3">
                      {[
                        {
                          url:     'techcrunch.com › 2024 › scaleflow-series-a',
                          title:   'ScaleFlow raises $12M Series A to triple US outbound sales capacity',
                          snippet: 'The San Francisco startup plans to expand its go-to-market team and scale enterprise outbound with new SDR hires…',
                          hi: true,
                        },
                        {
                          url:     'forbes.com › startups › 2024',
                          title:   'Top RevOps startups to watch in 2024',
                          snippet: 'ScaleFlow among companies reshaping how B2B teams approach outbound sales automation and pipeline building…',
                          hi: false,
                        },
                        {
                          url:     'venturebeat.com › enterprise-ai',
                          title:   'ScaleFlow named top 50 AI startups by VentureBeat',
                          snippet: 'Recognition follows strong Q4 performance with 340% ARR growth and rapid international expansion reported…',
                          hi: false,
                        },
                      ].map((r, i) => (
                        <div
                          key={i}
                          className={`p-3.5 rounded-xl transition-all ${
                            subStep >= 2 && r.hi
                              ? 'bg-indigo-500/10 border border-indigo-500/25'
                              : 'border border-transparent'
                          }`}
                        >
                          <div className="text-[10px] text-green-400/70 mb-0.5">{r.url}</div>
                          <div className={`text-[13px] font-semibold mb-1 leading-snug ${subStep >= 2 && r.hi ? 'text-indigo-300' : 'text-white/55'}`}>
                            {r.title}
                          </div>
                          <div className="text-[11px] text-white/30 leading-relaxed">{r.snippet}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── ARTICLE ── */}
              {phase === 'article' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white/85 bg-white/10 px-2 py-0.5 rounded">TechCrunch</span>
                    <span className="text-[10px] text-white/25">· 3 days ago</span>
                  </div>
                  <h3 className="text-white/88 font-bold text-[15px] leading-snug">
                    ScaleFlow raises $12M Series A to triple US outbound sales capacity
                  </h3>
                  <div className="space-y-3.5">
                    {ARTICLE_PARAS.map((para, i) => (
                      <ArticlePara
                        key={i}
                        text={para}
                        state={i < artPara ? 'past' : i === artPara ? 'current' : 'future'}
                        setRef={el => { paraElems.current[i] = el }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── EMAIL ── */}
              {(phase === 'email' || phase === 'done') && (
                <div>
                  <div className="border-b border-white/[0.06] pb-3 mb-5 space-y-2">
                    {[
                      { l: 'From',    v: 'alex@yourcompany.com',              c: 'text-white/45' },
                      { l: 'To',      v: 'sarah@scaleflow.io',                c: 'text-indigo-400' },
                      { l: 'Subject', v: "ScaleFlow's Q3 SDR expansion",      c: 'text-white/70' },
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
                    <div className="mt-6 flex items-center gap-3">
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

            {/* ── Notes panel (article / email / done) ── */}
            {showSplit && (
              <div className="w-[200px] shrink-0 p-4 overflow-y-auto flex flex-col gap-2.5">
                <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                  <span className="text-indigo-400">✦</span>
                  Research Notes
                </div>

                {notesList.length === 0 ? (
                  <div className="text-[11px] text-white/15 italic">Collecting signals…</div>
                ) : (
                  notesList.map((note, i) => (
                    <div
                      key={i}
                      className={`note-item flex items-start gap-1.5 text-[11px] leading-snug ${
                        (phase === 'email' || phase === 'done') ? 'text-white/38' : 'text-white/60'
                      }`}
                    >
                      <span className="text-indigo-400/70 text-[9px] mt-[3px] shrink-0">✦</span>
                      <span>{note}</span>
                    </div>
                  ))
                )}

                {(phase === 'email' || phase === 'done') && notesList.length > 0 && (
                  <div className="mt-2 pt-2.5 border-t border-white/[0.06]">
                    <div className="text-[10px] text-indigo-400/70 font-semibold mb-1.5">Building from</div>
                    <div className="text-[11px] text-white/40 leading-snug space-y-1">
                      <div>→ SDR expansion signal</div>
                      <div>→ Series A context</div>
                      <div>→ Growth quote</div>
                    </div>
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
