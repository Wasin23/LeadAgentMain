'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type Phase = 'database' | 'linkedin' | 'websearch' | 'article' | 'email' | 'report' | 'crm' | 'done'

const SEARCH_QUERY = 'ScaleFlow Series A funding 2024'
const WPS = 70

const EMAIL_BODY = `Hi Sarah,

Saw ScaleFlow just closed $12M Series A and you're scaling the team from 12 to 35 by Q3. That usually means outbound volume becomes the bottleneck right as the board starts expecting pipeline numbers.

The SDR expansion is the tell — you need those reps producing fast, not spending the first 60 days building a prospecting workflow from scratch.

Your agent sources leads, researches each account, and writes the email from real context — funding news, hiring signals, the exact role. Your SDRs hit the ground with a full sequence already running.

Worth 15 minutes to see how it fits the Q3 push?

Alex`

const ARTICLE_PARAS = [
  "ScaleFlow, the San Francisco-based revenue intelligence platform, announced today a $12M Series A led by Sequoia Capital, with participation from Y Combinator and a group of strategic angels with backgrounds in enterprise GTM and outbound sales infrastructure.",
  "The raise will fund an aggressive US expansion — growing the go-to-market team from 12 to 35 by Q3, with the first hiring wave focused on Senior SDRs to anchor a new enterprise outbound motion targeting B2B SaaS and services companies.",
  `"We're not buying another point solution," said Sarah Chen, Head of Growth at ScaleFlow. "We need outbound that actually works at scale — something that researches the account, writes a real email, and doesn't require someone babysitting every sequence all day."`,
]

const PARA_NOTES = [
  '$12M Series A · Sequoia + YC',
  'Team: 12 → 35 by Q3 · 3 Senior SDRs',
  '"Need outbound at scale" — Sarah Chen, HoG',
]

const SEARCH_RESULTS = [
  {
    url:     'techcrunch.com › 2024 › scaleflow-series-a',
    title:   'ScaleFlow raises $12M Series A to triple US outbound sales capacity',
    snippet: 'The startup plans to expand from 12 to 35 employees by Q3, focusing on senior SDRs and enterprise AEs…',
    hi: true,
  },
  {
    url:     'linkedin.com › company › scaleflow › posts',
    title:   'ScaleFlow is hiring — 3 Senior SDRs for US enterprise expansion',
    snippet: "We're scaling fast and looking for experienced outbound reps to anchor our new US enterprise motion…",
    hi: false,
  },
  {
    url:     'forbes.com › startups › 2024',
    title:   'Top RevOps startups to watch: ScaleFlow, Outplay, and Apollo',
    snippet: 'ScaleFlow among companies reshaping how B2B teams approach outbound automation…',
    hi: false,
  },
]

const REPORT_SECTIONS = [
  {
    label: 'Company signals',
    accent: false,
    items: ['$12M Series A · Sequoia Capital', 'Headcount: 12 → 35 by Q3', 'Hiring 3 Senior SDRs (enterprise)', '340% ARR growth in Q4'],
  },
  {
    label: 'Contact intel',
    accent: false,
    items: ['Role: Head of Growth', 'Influence: Budget holder, decision-maker', 'Pain point: Outbound at scale, fast ramp'],
  },
  {
    label: 'Verdict',
    accent: true,
    items: ['Fit score: 94 / 100', '✓ High fit — proceed with outreach'],
  },
]

const CRM_FIELDS = [
  { label: 'Contact', value: 'Sarah Chen' },
  { label: 'Company', value: 'ScaleFlow' },
  { label: 'Stage',   value: 'Outreach Queued' },
  { label: 'Tags',    value: 'Series A · Hiring · Fast Growth' },
]

const CRM_ACTIONS = ['Contact record updated', 'Email sequence queued', 'Follow-up scheduled in 5 days']

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function ScanText({ text, speed = 14 }: { text: string; speed?: number }) {
  const [idx, setIdx] = useState(0)
  const words = useMemo(() => text.split(' '), [text])
  useEffect(() => {
    setIdx(0)
    let i = 0
    const t = setInterval(() => { i++; setIdx(i); if (i >= words.length) clearInterval(t) }, 1000 / speed)
    return () => clearInterval(t)
  }, [text, speed, words.length])
  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          <span className={i < idx ? 'text-white/62' : i === idx ? 'bg-indigo-500/30 text-white/90 rounded-sm px-0.5' : 'text-white/18'}>{word}</span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  )
}

function ArticlePara({ text, state, setRef }: { text: string; state: 'past' | 'current' | 'future'; setRef: (el: HTMLParagraphElement | null) => void }) {
  const [idx, setIdx] = useState(0)
  const words = useMemo(() => text.split(' '), [text])
  useEffect(() => {
    if (state !== 'current') { setIdx(state === 'past' ? words.length + 1 : 0); return }
    setIdx(0)
    let i = 0
    const t = setInterval(() => { i++; setIdx(i); if (i >= words.length) clearInterval(t) }, 1000 / WPS)
    return () => clearInterval(t)
  }, [state, words.length])
  return (
    <p ref={setRef} className={`text-[12px] leading-[1.75] transition-opacity duration-500 ${state === 'future' ? 'opacity-20' : 'opacity-100'}`}>
      {state === 'past' ? (
        <span className="text-white/58">{text}</span>
      ) : state === 'future' ? (
        <span className="text-white/50">{text}</span>
      ) : (
        words.map((word, i) => (
          <span key={i}>
            <span className={i < idx ? 'text-white/62' : i === idx ? 'bg-indigo-500/30 text-white/92 rounded-sm px-0.5' : 'text-white/18'}>{word}</span>
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))
      )}
    </p>
  )
}

const TAB_LABELS: Record<Phase, string> = {
  database:  'Prospect Engine',
  linkedin:  'ScaleFlow · LinkedIn',
  websearch: 'Google',
  article:   'TechCrunch · Series A',
  email:     'New Message',
  report:    'Research Report',
  crm:       'CRM',
  done:      'CRM',
}

const URL_LABELS: Record<Phase, string> = {
  database:  'meridian://prospect-engine/search',
  linkedin:  'linkedin.com/company/scaleflow',
  websearch: 'google.com/search?q=ScaleFlow+Series+A+funding+2024',
  article:   'techcrunch.com › 2024 › scaleflow-raises-12m-series-a',
  email:     'mail.google.com · Compose',
  report:    'meridian://research-report/scaleflow',
  crm:       'crm · Contacts',
  done:      'crm · Contacts',
}

const STATUS_LABELS: Record<Phase, string> = {
  database:  'Searching ICP database…',
  linkedin:  'Scanning profile…',
  websearch: 'Finding signals…',
  article:   'Reading article…',
  email:     'Drafting email…',
  report:    'Building report…',
  crm:       'Pushing to CRM…',
  done:      'All done',
}

const TABS: Phase[] = ['database', 'linkedin', 'websearch', 'article', 'email', 'report', 'crm']

export function AiResearchSection() {
  const [phase, setPhase]             = useState<Phase>('database')
  const [subStep, setSubStep]         = useState(0)
  const [barPct, setBarPct]           = useState(0)
  const [queryIdx, setQueryIdx]       = useState(0)
  const [webResults, setWebResults]   = useState(0)
  const [artPara, setArtPara]         = useState(0)
  const [notesList, setNotesList]     = useState<string[]>([])
  const [typed, setTyped]             = useState(0)
  const [reportSec, setReportSec]     = useState(0)
  const [reportItems, setReportItems] = useState(0)
  const [crmField, setCrmField]       = useState(0)
  const [crmBar, setCrmBar]           = useState(0)
  const [crmActions, setCrmActions]   = useState(0)
  const alive = useRef(true)

  const articleScrollRef = useRef<HTMLDivElement>(null)
  const paraElems = useRef<(HTMLParagraphElement | null)[]>(Array(ARTICLE_PARAS.length).fill(null))

  useEffect(() => {
    if (phase !== 'article') return
    const el = paraElems.current[artPara]
    const container = articleScrollRef.current
    if (!el || !container) return
    container.scrollTo({ top: Math.max(0, el.offsetTop - 32), behavior: 'smooth' })
  }, [artPara, phase])

  useEffect(() => {
    alive.current = true
    let typeTimer: ReturnType<typeof setInterval> | null = null

    const run = async () => {
      setPhase('database'); setSubStep(0); setBarPct(0); setQueryIdx(0); setWebResults(0)
      setTyped(0); setArtPara(0); setNotesList([])
      setReportSec(0); setReportItems(0); setCrmField(0); setCrmBar(0); setCrmActions(0)

      // ── DATABASE ──
      await sleep(500); if (!alive.current) return
      setSubStep(1)
      requestAnimationFrame(() => requestAnimationFrame(() => { if (alive.current) setBarPct(100) }))
      await sleep(1400); if (!alive.current) return
      setSubStep(2); await sleep(700); if (!alive.current) return
      setSubStep(3); await sleep(700); if (!alive.current) return

      // ── LINKEDIN ──
      setPhase('linkedin'); setSubStep(0)
      await sleep(3200); if (!alive.current) return

      // ── WEBSEARCH: type query then show results ──
      setPhase('websearch'); setSubStep(0); setQueryIdx(0); setWebResults(0)
      await sleep(200); if (!alive.current) return
      for (let i = 0; i <= SEARCH_QUERY.length; i++) {
        if (!alive.current) return
        setQueryIdx(i)
        await sleep(52)
      }
      await sleep(300); if (!alive.current) return
      setSubStep(1)
      for (let i = 1; i <= SEARCH_RESULTS.length; i++) {
        if (!alive.current) return
        setWebResults(i)
        await sleep(380)
      }
      setSubStep(2); await sleep(500); if (!alive.current) return

      // ── ARTICLE ──
      setPhase('article'); setArtPara(0); setNotesList([])
      for (let i = 0; i < ARTICLE_PARAS.length; i++) {
        if (!alive.current) return
        setArtPara(i)
        const dur = Math.ceil(ARTICLE_PARAS[i].split(' ').length / WPS) * 1000 + 60
        await sleep(dur)
        if (!alive.current) return
        if (PARA_NOTES[i]) setNotesList(n => [...n, PARA_NOTES[i]])
      }
      await sleep(400); if (!alive.current) return

      // ── EMAIL ──
      setPhase('email'); setTyped(0)
      typeTimer = setInterval(() => {
        setTyped(n => {
          if (n >= EMAIL_BODY.length) { clearInterval(typeTimer!); typeTimer = null; return n }
          return n + 1
        })
      }, 12)
      await sleep(EMAIL_BODY.length * 12 + 400)
      if (typeTimer) { clearInterval(typeTimer); typeTimer = null }
      if (!alive.current) return

      // ── RESEARCH REPORT ──
      setPhase('report'); setReportSec(0); setReportItems(0)
      for (let s = 0; s < REPORT_SECTIONS.length; s++) {
        if (!alive.current) return
        setReportSec(s + 1)
        for (let item = 1; item <= REPORT_SECTIONS[s].items.length; item++) {
          if (!alive.current) return
          setReportItems(s * 10 + item)
          await sleep(270)
        }
        await sleep(180)
      }
      await sleep(600); if (!alive.current) return

      // ── CRM ──
      setPhase('crm'); setCrmField(0); setCrmBar(0); setCrmActions(0)
      for (let f = 1; f <= CRM_FIELDS.length; f++) {
        if (!alive.current) return
        setCrmField(f)
        await sleep(360)
      }
      await sleep(280); if (!alive.current) return
      requestAnimationFrame(() => requestAnimationFrame(() => { if (alive.current) setCrmBar(100) }))
      await sleep(1100); if (!alive.current) return
      for (let a = 1; a <= CRM_ACTIONS.length; a++) {
        if (!alive.current) return
        setCrmActions(a)
        await sleep(350)
      }
      await sleep(600); if (!alive.current) return

      setPhase('done')
      await sleep(2500); if (!alive.current) return
      run()
    }

    run()
    return () => { alive.current = false; if (typeTimer) clearInterval(typeTimer) }
  }, [])

  const activeTab = phase === 'done' ? 'crm' : phase
  const showSplit = phase === 'article' || phase === 'email' || phase === 'done' || phase === 'report'

  return (
    <section className="relative z-10 py-28 px-6">
      <style>{`
        @keyframes noteSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .note-item { animation: noteSlideIn 0.35s ease-out forwards; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .slide-up { animation: slideUp 0.28s ease-out forwards; }
      `}</style>

      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-center gap-16">

        {/* ── Left copy ── */}
        <div className="flex-1 max-w-[420px] shrink-0">
          <p className="text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-4">AI Research</p>
          <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
            Reads the room<br />before writing.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-8">
            Your agent pulls company profiles, recent news, hiring signals, and role context — then writes from that research. Not a template.
          </p>
          <div className="space-y-3 mb-10">
            {[
              'Company profile and role intelligence',
              'Funding rounds and hiring signals',
              'Recent news and LinkedIn activity',
              'Tech stack and buyer intent data',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-white/55 text-[15px]">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <Link href="/signin" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105">
            Start free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* ── Browser window ── */}
        <div className="flex-1 w-full min-w-0">
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
              {TABS.map(tab => (
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

            {/* Content */}
            <div className={showSplit ? 'flex h-[560px]' : 'min-h-[480px] p-6 overflow-y-auto'}>

              <div
                ref={articleScrollRef}
                className={`overflow-y-auto ${showSplit ? 'flex-1 p-6 border-r border-white/[0.06]' : 'w-full'}`}
              >

                {/* DATABASE */}
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
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${barPct}%`, transition: 'width 1.3s ease-out' }} />
                        </div>
                      </div>
                    )}
                    {subStep >= 2 && (
                      <div className="space-y-2 text-[12px] border-t border-white/[0.06] pt-4">
                        <div className="flex items-center gap-2 text-white/40"><span className="text-green-400">✓</span><span>12,441 initial matches found</span></div>
                        <div className="flex items-center gap-2 text-white/40"><span className="text-green-400">✓</span><span>1,203 passed intent signal filters</span></div>
                        <div className="flex items-center gap-2 text-white/55 font-medium"><span className="text-indigo-400">→</span><span>8 high-fit leads selected for outreach</span></div>
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

                {/* LINKEDIN */}
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
                        <ScanText text="AI-powered revenue platform helping B2B teams scale outbound without adding headcount. Trusted by 200+ fast-growing companies across North America and Europe." speed={70} />
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">Key People</div>
                      <div className="space-y-2">
                        {[{ n: 'Sarah Chen', r: 'Head of Growth' }, { n: 'Marcus Lee', r: 'VP of Sales' }, { n: 'Priya Nair', r: 'Director of Revenue Ops' }].map(p => (
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
                          { t: 'Hiring 3 Senior SDRs — US enterprise expansion', d: '2d' },
                          { t: 'Our outbound playbook for post-Series A companies', d: '5d' },
                          { t: 'ScaleFlow reaches 340% ARR growth in Q4', d: '2w' },
                        ].map((a, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-[11px] leading-relaxed flex-1"><ScanText text={a.t} speed={70} /></span>
                            <span className="text-[10px] text-white/18 shrink-0">{a.d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* WEBSEARCH */}
                {phase === 'websearch' && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.05] border border-white/[0.09] text-[13px]">
                      <span className="text-white/30 text-sm">⌕</span>
                      <span className="text-white/70 font-mono">
                        {SEARCH_QUERY.slice(0, queryIdx)}
                        {queryIdx < SEARCH_QUERY.length && (
                          <span className="inline-block w-px h-[13px] bg-indigo-400 animate-pulse align-text-bottom ml-px" />
                        )}
                      </span>
                    </div>
                    {subStep >= 1 && <div className="text-[10px] text-white/25">About 8,420 results (0.31 seconds)</div>}
                    {subStep >= 1 && (
                      <div className="space-y-3">
                        {SEARCH_RESULTS.slice(0, webResults).map((r, i) => (
                          <div key={i} className={`slide-up p-3.5 rounded-xl transition-all ${subStep >= 2 && r.hi ? 'bg-indigo-500/10 border border-indigo-500/25' : 'border border-transparent'}`}>
                            <div className="text-[10px] text-green-400/70 mb-0.5">{r.url}</div>
                            <div className={`text-[13px] font-semibold mb-1 leading-snug ${subStep >= 2 && r.hi ? 'text-indigo-300' : 'text-white/55'}`}>{r.title}</div>
                            <div className="text-[11px] text-white/30 leading-relaxed">{r.snippet}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ARTICLE */}
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

                {/* EMAIL */}
                {(phase === 'email' || phase === 'done') && (
                  <div>
                    <div className="border-b border-white/[0.06] pb-3 mb-5 space-y-2">
                      {[
                        { l: 'From',    v: 'alex@yourcompany.com', c: 'text-white/45' },
                        { l: 'To',      v: 'sarah@scaleflow.io',   c: 'text-indigo-400' },
                        { l: 'Subject', v: "ScaleFlow's Q3 SDR expansion", c: 'text-white/70' },
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

                {/* RESEARCH REPORT */}
                {phase === 'report' && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-xs shrink-0">SC</div>
                      <div>
                        <div className="text-white/80 font-bold text-sm">ScaleFlow · Sarah Chen</div>
                        <div className="text-white/30 text-[11px]">Head of Growth · San Francisco</div>
                      </div>
                      <span className="ml-auto text-[10px] font-bold text-indigo-400/50 uppercase tracking-widest">Research Report</span>
                    </div>
                    {REPORT_SECTIONS.slice(0, reportSec).map((sec, si) => {
                      const shown = Math.max(0, reportItems - si * 10)
                      return (
                        <div key={si} className="slide-up space-y-2">
                          <div className={`text-[10px] font-bold uppercase tracking-widest ${sec.accent ? 'text-green-400/70' : 'text-white/25'}`}>{sec.label}</div>
                          {sec.items.slice(0, shown).map((item, ii) => (
                            <div key={ii} className={`slide-up flex items-center gap-2 text-[12px] ${sec.accent ? 'text-green-400' : 'text-white/55'}`}>
                              <span className={`text-[9px] shrink-0 ${sec.accent ? 'text-green-400' : 'text-indigo-400'}`}>→</span>
                              {item}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* CRM */}
                {phase === 'crm' && (
                  <div className="space-y-5">
                    <div className="text-[11px] text-white/30">CRM · Pushing contact record</div>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                      {CRM_FIELDS.map((f, i) => (
                        <div key={f.label} className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.05] last:border-0 transition-all duration-300 ${crmField > i ? 'opacity-100' : 'opacity-20'}`}>
                          <span className="text-white/25 text-[11px] w-16 shrink-0">{f.label}</span>
                          <span className={`text-[12px] font-medium ${crmField > i ? 'text-white/70' : 'text-white/15'}`}>{crmField > i ? f.value : '—'}</span>
                          {crmField > i && <span className="ml-auto text-[9px] text-green-400/60">✓</span>}
                        </div>
                      ))}
                    </div>
                    {crmField >= CRM_FIELDS.length && (
                      <div className="slide-up space-y-1.5">
                        <div className="flex justify-between text-[10px] text-white/25">
                          <span>Syncing record</span>
                          <span className="text-indigo-400">{crmBar === 100 ? '100%' : '…'}</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${crmBar}%`, transition: 'width 1.0s ease-out' }} />
                        </div>
                      </div>
                    )}
                    {crmActions > 0 && (
                      <div className="space-y-2">
                        {CRM_ACTIONS.slice(0, crmActions).map((action, i) => (
                          <div key={i} className="slide-up flex items-center gap-2 text-[12px] text-green-400">
                            <span className="text-[10px]">✓</span>
                            {action}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Notes panel */}
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
                      <div key={i} className={`note-item flex items-start gap-1.5 text-[11px] leading-snug ${(phase === 'email' || phase === 'done' || phase === 'report') ? 'text-white/38' : 'text-white/60'}`}>
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

      </div>
    </section>
  )
}
