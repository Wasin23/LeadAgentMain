'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

type Phase = 'profile' | 'database' | 'linkedin' | 'websearch' | 'article' | 'email' | 'report' | 'crm' | 'done'

const SEARCH_QUERY = 'ScaleFlow Series A funding 2024'
const WPS = 70

const PROFILE_FIELDS = [
  { label: 'Company',        value: 'Apex Revenue' },
  { label: 'Product',        value: 'AI-powered outbound for B2B sales teams' },
  { label: 'Target role',    value: 'Head of Growth · VP Sales · CRO' },
  { label: 'Target company', value: 'B2B SaaS · 11–500 employees' },
  { label: 'Funding stage',  value: 'Series A – C' },
  { label: 'Geography',      value: 'North America · Western Europe' },
]

const EXTRACTED_KEYWORDS = ['B2B SaaS', 'Head of Growth', 'Series A', '11–500 employees', 'North America']

const DB_LEADS = [
  { initials: 'SC', name: 'Sarah Chen',   title: 'Head of Growth',    company: 'ScaleFlow',  score: 94, top: true  },
  { initials: 'JR', name: 'James Rivera', title: 'VP of Growth',      company: 'Outpost AI', score: 88, top: false },
  { initials: 'PS', name: 'Priya Shah',   title: 'Growth Lead',       company: 'Fluxcore',   score: 85, top: false },
  { initials: 'DO', name: 'Daniel Osei',  title: 'Head of Revenue',   company: 'Gridlane',   score: 82, top: false },
  { initials: 'MT', name: 'Mia Tanaka',   title: 'Dir. of Growth',    company: 'Vaultworks', score: 79, top: false },
]

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
  { url: 'techcrunch.com › 2024 › scaleflow-series-a', title: 'ScaleFlow raises $12M Series A to triple US outbound sales capacity', snippet: 'The startup plans to expand from 12 to 35 employees by Q3, focusing on senior SDRs and enterprise AEs…', hi: true },
  { url: 'linkedin.com › company › scaleflow › posts',  title: 'ScaleFlow is hiring — 3 Senior SDRs for US enterprise expansion',   snippet: "We're scaling fast and looking for experienced outbound reps to anchor our new US enterprise motion…", hi: false },
  { url: 'forbes.com › startups › 2024',                title: 'Top RevOps startups to watch: ScaleFlow, Outplay, and Apollo',          snippet: 'ScaleFlow among companies reshaping how B2B teams approach outbound automation…', hi: false },
]

const REPORT_SECTIONS = [
  { label: 'Company signals', accent: false, items: ['$12M Series A · Sequoia Capital', 'Headcount: 12 → 35 by Q3', 'Hiring 3 Senior SDRs (enterprise)', '340% ARR growth in Q4'] },
  { label: 'Contact intel',   accent: false, items: ['Role: Head of Growth', 'Influence: Budget holder, decision-maker', 'Pain point: Outbound at scale, fast ramp'] },
  { label: 'Verdict',         accent: true,  items: ['Fit score: 94 / 100', '✓ High fit — proceed with outreach'] },
]

const CRM_FIELDS   = [{ label: 'Contact', value: 'Sarah Chen' }, { label: 'Company', value: 'ScaleFlow' }, { label: 'Stage', value: 'Outreach Queued' }, { label: 'Tags', value: 'Series A · Hiring · Fast Growth' }]
const CRM_ACTIONS  = ['Contact record created', 'Email sequence enrolled', 'Follow-up task scheduled (5 days)']

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function ScanText({ text, speed = 14 }: { text: string; speed?: number }) {
  const [idx, setIdx] = useState(0)
  const words = useMemo(() => text.split(' '), [text])
  useEffect(() => {
    setIdx(0); let i = 0
    const t = setInterval(() => { i++; setIdx(i); if (i >= words.length) clearInterval(t) }, 1000 / speed)
    return () => clearInterval(t)
  }, [text, speed, words.length])
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className={i < idx ? 'text-white/62' : i === idx ? 'bg-indigo-500/30 text-white/90 rounded-sm px-0.5' : 'text-white/18'}>{w}</span>
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
    setIdx(0); let i = 0
    const t = setInterval(() => { i++; setIdx(i); if (i >= words.length) clearInterval(t) }, 1000 / WPS)
    return () => clearInterval(t)
  }, [state, words.length])
  return (
    <p ref={setRef} className={`text-[12px] leading-[1.75] transition-opacity duration-500 ${state === 'future' ? 'opacity-20' : 'opacity-100'}`}>
      {state === 'past' ? <span className="text-white/58">{text}</span>
      : state === 'future' ? <span className="text-white/50">{text}</span>
      : words.map((w, i) => (
          <span key={i}>
            <span className={i < idx ? 'text-white/62' : i === idx ? 'bg-indigo-500/30 text-white/92 rounded-sm px-0.5' : 'text-white/18'}>{w}</span>
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
    </p>
  )
}

const TAB_LABELS: Record<Phase, string> = {
  profile:  'Your Profile',
  database: 'apollo · People',
  linkedin: 'LinkedIn · ScaleFlow',
  websearch:'Google Search',
  article:  'TechCrunch',
  email:    'Gmail · Compose',
  report:   'Research Report',
  crm:      'HubSpot CRM',
  done:     'HubSpot CRM',
}

const URL_LABELS: Record<Phase, string> = {
  profile:  'meridian://your-profile',
  database: 'app.apollo.io/#/people?q=B2B+SaaS+Head+of+Growth+Series+A',
  linkedin: 'linkedin.com/company/scaleflow',
  websearch:'google.com/search?q=ScaleFlow+Series+A+funding+2024',
  article:  'techcrunch.com › 2024 › scaleflow-raises-12m-series-a',
  email:    'mail.google.com/mail/u/0/#compose',
  report:   'meridian://research-report/scaleflow',
  crm:      'app.hubspot.com/contacts/sarah-chen',
  done:     'app.hubspot.com/contacts/sarah-chen',
}

const STATUS_LABELS: Record<Phase, string> = {
  profile:  'Reading your profile…',
  database: 'Searching prospects…',
  linkedin: 'Scanning company…',
  websearch:'Finding signals…',
  article:  'Reading article…',
  email:    'Drafting email…',
  report:   'Building report…',
  crm:      'Pushing to CRM…',
  done:     'All done',
}

const TABS: Phase[] = ['profile', 'database', 'linkedin', 'websearch', 'article', 'email', 'report', 'crm']

export function AiResearchSection() {
  const [phase, setPhase]               = useState<Phase>('profile')
  const [profileItems, setProfileItems] = useState(0)
  const [profileKw, setProfileKw]       = useState(0)
  const [dbKeywords, setDbKeywords]     = useState(0)
  const [dbRows, setDbRows]             = useState(0)
  const [subStep, setSubStep]           = useState(0)
  const [queryIdx, setQueryIdx]         = useState(0)
  const [webResults, setWebResults]     = useState(0)
  const [artPara, setArtPara]           = useState(0)
  const [notesList, setNotesList]       = useState<string[]>([])
  const [typed, setTyped]               = useState(0)
  const [reportSec, setReportSec]       = useState(0)
  const [reportItems, setReportItems]   = useState(0)
  const [crmField, setCrmField]         = useState(0)
  const [crmBar, setCrmBar]             = useState(0)
  const [crmActions, setCrmActions]     = useState(0)
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
      setPhase('profile'); setProfileItems(0); setProfileKw(0)
      setDbKeywords(0); setDbRows(0); setSubStep(0); setQueryIdx(0); setWebResults(0)
      setTyped(0); setArtPara(0); setNotesList([])
      setReportSec(0); setReportItems(0); setCrmField(0); setCrmBar(0); setCrmActions(0)

      await sleep(400); if (!alive.current) return
      for (let i = 1; i <= PROFILE_FIELDS.length; i++) {
        if (!alive.current) return
        setProfileItems(i); await sleep(270)
      }
      await sleep(500); if (!alive.current) return
      for (let i = 1; i <= EXTRACTED_KEYWORDS.length; i++) {
        if (!alive.current) return
        setProfileKw(i); await sleep(320)
      }
      await sleep(600); if (!alive.current) return

      setPhase('database'); setDbKeywords(0); setDbRows(0); setSubStep(0)
      await sleep(300); if (!alive.current) return
      for (let i = 1; i <= EXTRACTED_KEYWORDS.length; i++) {
        if (!alive.current) return
        setDbKeywords(i); await sleep(380)
      }
      await sleep(400); if (!alive.current) return
      for (let i = 1; i <= DB_LEADS.length; i++) {
        if (!alive.current) return
        setDbRows(i); await sleep(260)
      }
      setSubStep(1); await sleep(900); if (!alive.current) return

      setPhase('linkedin')
      await sleep(4200); if (!alive.current) return

      setPhase('websearch'); setSubStep(0); setQueryIdx(0); setWebResults(0)
      await sleep(200); if (!alive.current) return
      for (let i = 0; i <= SEARCH_QUERY.length; i++) {
        if (!alive.current) return
        setQueryIdx(i); await sleep(52)
      }
      await sleep(300); if (!alive.current) return
      setSubStep(1)
      for (let i = 1; i <= SEARCH_RESULTS.length; i++) {
        if (!alive.current) return
        setWebResults(i); await sleep(380)
      }
      setSubStep(2); await sleep(500); if (!alive.current) return

      setPhase('article'); setArtPara(0); setNotesList([])
      for (let i = 0; i < ARTICLE_PARAS.length; i++) {
        if (!alive.current) return
        setArtPara(i)
        const dur = Math.ceil(ARTICLE_PARAS[i].split(' ').length / WPS) * 1000 + 60
        await sleep(dur); if (!alive.current) return
        if (PARA_NOTES[i]) setNotesList(n => [...n, PARA_NOTES[i]])
      }
      await sleep(400); if (!alive.current) return

      setPhase('email'); setTyped(0)
      typeTimer = setInterval(() => {
        setTyped(n => { if (n >= EMAIL_BODY.length) { clearInterval(typeTimer!); typeTimer = null; return n } return n + 1 })
      }, 12)
      await sleep(EMAIL_BODY.length * 12 + 400)
      if (typeTimer) { clearInterval(typeTimer); typeTimer = null }
      if (!alive.current) return

      setPhase('report'); setReportSec(0); setReportItems(0)
      for (let s = 0; s < REPORT_SECTIONS.length; s++) {
        if (!alive.current) return
        setReportSec(s + 1)
        for (let item = 1; item <= REPORT_SECTIONS[s].items.length; item++) {
          if (!alive.current) return
          setReportItems(s * 10 + item); await sleep(270)
        }
        await sleep(180)
      }
      await sleep(600); if (!alive.current) return

      setPhase('crm'); setCrmField(0); setCrmBar(0); setCrmActions(0)
      for (let f = 1; f <= CRM_FIELDS.length; f++) {
        if (!alive.current) return
        setCrmField(f); await sleep(360)
      }
      await sleep(280); if (!alive.current) return
      requestAnimationFrame(() => requestAnimationFrame(() => { if (alive.current) setCrmBar(100) }))
      await sleep(1100); if (!alive.current) return
      for (let a = 1; a <= CRM_ACTIONS.length; a++) {
        if (!alive.current) return
        setCrmActions(a); await sleep(350)
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
        @keyframes noteSlideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .note-item { animation: noteSlideIn 0.35s ease-out forwards; }
        @keyframes slideUp { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
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
            {['Company profile and role intelligence', 'Funding rounds and hiring signals', 'Recent news and LinkedIn activity', 'Tech stack and buyer intent data'].map(f => (
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
                <div key={tab} className={`px-3.5 py-2.5 border-r border-white/[0.04] whitespace-nowrap shrink-0 transition-colors ${activeTab === tab ? 'text-white/80 bg-white/[0.05] border-b-2 border-b-indigo-500' : 'text-white/18'}`}>
                  {TAB_LABELS[tab]}
                </div>
              ))}
            </div>

            {/* Content */}
            <div className={showSplit ? 'flex h-[560px]' : 'min-h-[480px] overflow-y-auto'}>
              <div
                ref={articleScrollRef}
                className={`overflow-y-auto ${showSplit ? 'flex-1 border-r border-white/[0.06]' : 'w-full'}`}
              >

                {/* ── YOUR PROFILE ── */}
                {phase === 'profile' && (
                  <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Your Company Profile</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">Reading</span>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                      {PROFILE_FIELDS.map((f, i) => (
                        <div key={f.label} className={`flex items-start gap-3 px-4 py-2.5 border-b border-white/[0.05] last:border-0 transition-all duration-300 ${profileItems > i ? 'opacity-100' : 'opacity-0'}`}>
                          <span className="text-white/25 text-[11px] w-28 shrink-0 pt-px">{f.label}</span>
                          <span className="text-white/70 text-[12px] font-medium leading-snug">{f.value}</span>
                          {profileItems > i && <span className="ml-auto text-[9px] text-indigo-400/50 shrink-0 pt-px">✓ read</span>}
                        </div>
                      ))}
                    </div>
                    {profileKw > 0 && (
                      <div className="slide-up space-y-2.5">
                        <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Keywords extracted</div>
                        <div className="flex flex-wrap gap-1.5">
                          {EXTRACTED_KEYWORDS.slice(0, profileKw).map(kw => (
                            <span key={kw} className="slide-up px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-[11px] font-medium">{kw}</span>
                          ))}
                        </div>
                        {profileKw >= EXTRACTED_KEYWORDS.length && (
                          <div className="flex items-center gap-2 text-[11px] text-indigo-400/70 mt-1">
                            <span className="text-[9px]">→</span>
                            Searching prospect engine with these terms…
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── APOLLO PROSPECT ENGINE ── */}
                {phase === 'database' && (
                  <div className="overflow-hidden">
                    {/* Apollo nav */}
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0e0e10] border-b border-white/[0.06]">
                      <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: '#ffe234' }}>
                        <span className="font-black text-[10px]" style={{ color: '#1a1600' }}>A</span>
                      </div>
                      <span className="text-[11px] font-bold text-white/60">apollo</span>
                      <span className="text-white/15 text-[11px] mx-1">/</span>
                      <span className="text-[11px] text-white/35">People</span>
                      <span className="text-white/15 text-[11px] mx-1">/</span>
                      <span className="text-[11px]" style={{ color: '#ffe234' }}>Search</span>
                      <div className="ml-auto text-[10px] text-white/25">
                        {dbRows > 0 ? `${(dbRows * 847).toLocaleString()} results` : 'searching…'}
                      </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-1.5 px-4 py-2.5 bg-[#0e0e10] border-b border-white/[0.05] min-h-[42px]">
                      {EXTRACTED_KEYWORDS.slice(0, dbKeywords).map(kw => (
                        <span key={kw} className="slide-up flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: 'rgba(255,226,52,0.12)', border: '1px solid rgba(255,226,52,0.28)', color: '#ffe234' }}>
                          {kw} <span className="text-[8px] opacity-50 ml-0.5">×</span>
                        </span>
                      ))}
                    </div>

                    {/* Table header */}
                    {dbRows > 0 && (
                      <div className="grid grid-cols-[1fr_1fr_1fr_44px] gap-x-3 px-4 py-1.5 text-[9px] font-bold text-white/20 uppercase tracking-widest border-b border-white/[0.04] bg-[#0e0e10]">
                        <span>Name</span><span>Title</span><span>Company</span><span className="text-right">Fit</span>
                      </div>
                    )}

                    {/* Rows */}
                    {DB_LEADS.slice(0, dbRows).map((lead, i) => (
                      <div
                        key={lead.name}
                        className={`slide-up grid grid-cols-[1fr_1fr_1fr_44px] gap-x-3 items-center px-4 py-2.5 border-b border-white/[0.04] transition-all cursor-pointer hover:bg-white/[0.02]`}
                        style={subStep >= 1 && lead.top ? { background: 'rgba(255,226,52,0.06)', borderLeft: '2px solid #ffe234' } : {}}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0" style={lead.top ? { background: 'rgba(255,226,52,0.2)', color: '#ffe234' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>{lead.initials}</div>
                          <span className={`text-[11px] font-medium truncate ${lead.top ? 'text-white/85' : 'text-white/50'}`}>{lead.name}</span>
                        </div>
                        <span className={`text-[11px] truncate ${lead.top ? 'text-white/55' : 'text-white/30'}`}>{lead.title}</span>
                        <span className={`text-[11px] truncate ${lead.top ? 'text-white/55' : 'text-white/30'}`}>{lead.company}</span>
                        <div className="flex justify-end">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={lead.top ? { background: 'rgba(255,226,52,0.18)', color: '#ffe234' } : { color: 'rgba(255,255,255,0.2)' }}>{lead.score}</span>
                        </div>
                      </div>
                    ))}

                    {subStep >= 1 && dbRows >= DB_LEADS.length && (
                      <div className="px-4 py-2.5 flex items-center gap-2 text-[11px]" style={{ color: '#ffe234', background: 'rgba(255,226,52,0.05)', borderTop: '1px solid rgba(255,226,52,0.1)' }}>
                        <span className="text-[9px]">→</span>
                        Top match selected: Sarah Chen · ScaleFlow — beginning deep research
                      </div>
                    )}
                  </div>
                )}

                {/* ── LINKEDIN ── */}
                {phase === 'linkedin' && (
                  <div className="overflow-hidden bg-[#1b1f23]">
                    {/* LinkedIn top nav */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-[#1b1f23] border-b border-white/[0.08]">
                      <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ background: '#0A66C2' }}>
                        <span className="text-white font-black text-[14px] leading-none" style={{ fontFamily: 'Georgia, serif', letterSpacing: '-0.5px' }}>in</span>
                      </div>
                      <div className="flex-1 px-2.5 py-1 rounded bg-[#2d333b] text-[10px] text-white/30 max-w-[120px]">ScaleFlow</div>
                      <div className="ml-auto flex items-center gap-3 text-[10px]">
                        <span className="text-white/30">Home</span>
                        <span className="text-white/30">My Network</span>
                        <span className="text-[#70b5f9] font-semibold">Jobs</span>
                        <span className="text-white/30">Messaging</span>
                      </div>
                    </div>

                    {/* Cover banner */}
                    <div className="h-[72px]" style={{ background: 'linear-gradient(135deg, #0A66C2 0%, #084d93 50%, #063a70 100%)' }} />

                    {/* Company header */}
                    <div className="px-4 pb-3 bg-[#1b1f23] border-b border-white/[0.06]">
                      <div className="flex items-end gap-3 -mt-8 mb-2.5">
                        <div className="w-16 h-16 rounded-lg border-2 border-[#1b1f23] flex items-center justify-center text-white font-black text-xl shrink-0" style={{ background: '#0A66C2' }}>SF</div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-white font-bold text-[14px]">ScaleFlow</span>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <circle cx="7" cy="7" r="7" fill="#0A66C2"/>
                              <path d="M4 7l2.2 2.2L10 5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          <div className="text-[10px] text-white/45 leading-snug">Revenue Intelligence · San Francisco, CA</div>
                        </div>
                        <div className="flex gap-1.5 pb-1 shrink-0">
                          <button className="px-3.5 py-1 rounded-full text-white text-[10px] font-bold" style={{ background: '#0A66C2' }}>Connect</button>
                          <button className="px-3.5 py-1 rounded-full border text-[10px] font-bold" style={{ borderColor: '#0A66C2', color: '#70b5f9' }}>Follow</button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] flex-wrap">
                        <span className="text-white/35">Software Development</span>
                        <span className="text-white/20">·</span>
                        <span className="cursor-pointer hover:underline" style={{ color: '#70b5f9' }}>2,347 followers</span>
                        <span className="text-white/20">·</span>
                        <span className="text-white/35">47 employees</span>
                        <span className="text-white/20">·</span>
                        <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-semibold" style={{ background: 'rgba(5,118,66,0.15)', color: '#5cb85c', border: '1px solid rgba(5,118,66,0.25)' }}>Series A</span>
                        <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-semibold" style={{ background: 'rgba(10,102,194,0.15)', color: '#70b5f9', border: '1px solid rgba(10,102,194,0.25)' }}>B2B SaaS</span>
                      </div>
                    </div>

                    {/* LinkedIn tab nav */}
                    <div className="flex text-[11px] bg-[#1b1f23] border-b border-white/[0.06] px-2">
                      {['About', 'Posts', 'People', 'Jobs'].map((t, i) => (
                        <div key={t} className={`px-4 py-2.5 cursor-pointer font-medium ${i === 0 ? 'text-white border-b-2 border-white' : 'text-white/30 hover:text-white/55'}`}>{t}</div>
                      ))}
                    </div>

                    <div className="p-4 space-y-3 bg-[#1b1f23]">
                      {/* About card */}
                      <div className="rounded-lg border border-white/[0.06] bg-[#23272e] p-4">
                        <div className="text-[11px] font-bold text-white/70 mb-2">About</div>
                        <div className="text-[12px] text-white/55 leading-relaxed">
                          <ScanText text="AI-powered revenue platform helping B2B teams scale outbound without adding headcount. Trusted by 200+ fast-growing companies across North America and Europe." speed={60} />
                        </div>
                      </div>

                      {/* Posts card */}
                      <div className="rounded-lg border border-white/[0.06] bg-[#23272e] overflow-hidden">
                        <div className="px-4 pt-3 pb-1 text-[11px] font-bold text-white/70">Posts</div>
                        {[
                          { text: "We're hiring 3 Senior SDRs to anchor our new US enterprise outbound motion. If you've run complex multi-touch sequences at scale, we want to talk.", likes: 24, comments: 8, ago: '2d' },
                          { text: "340% ARR growth in Q4. We stopped sending generic blasts and started researching every account before the first send. The difference was immediate.", likes: 87, comments: 31, ago: '5d' },
                        ].map((post, i) => (
                          <div key={i} className="px-4 py-3 border-t border-white/[0.05]">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: '#0A66C2' }}>SF</div>
                              <div>
                                <div className="text-[10px] font-semibold text-white/65">ScaleFlow</div>
                                <div className="text-[9px] text-white/25">{post.ago} ago</div>
                              </div>
                            </div>
                            <div className="text-[11px] text-white/50 leading-relaxed mb-2.5">
                              <ScanText text={post.text} speed={50} />
                            </div>
                            <div className="flex gap-4 text-[9px] text-white/25 pt-2 border-t border-white/[0.05]">
                              <span className="cursor-pointer hover:text-[#70b5f9]">Like · {post.likes}</span>
                              <span className="cursor-pointer hover:text-[#70b5f9]">Comment · {post.comments}</span>
                              <span className="cursor-pointer hover:text-[#70b5f9]">Repost</span>
                              <span className="cursor-pointer hover:text-[#70b5f9]">Send</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* People card */}
                      <div className="rounded-lg border border-white/[0.06] bg-[#23272e] overflow-hidden">
                        <div className="px-4 pt-3 pb-1 text-[11px] font-bold text-white/70">People at ScaleFlow</div>
                        {[
                          { i: 'SC', n: 'Sarah Chen',  r: 'Head of Growth',      target: true },
                          { i: 'ML', n: 'Marcus Lee',  r: 'VP of Sales',          target: false },
                          { i: 'PN', n: 'Priya Nair',  r: 'Dir. of Revenue Ops',  target: false },
                        ].map(p => (
                          <div key={p.n} className={`flex items-center gap-3 px-4 py-3 border-t border-white/[0.05] ${p.target ? 'bg-[#0A66C2]/8' : ''}`}>
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${p.target ? 'text-white' : 'bg-white/[0.08] text-white/35'}`} style={p.target ? { background: '#0A66C2' } : {}}>
                              {p.i}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-[12px] font-semibold ${p.target ? 'text-[#70b5f9]' : 'text-white/55'}`}>{p.n}</div>
                              <div className="text-[10px] text-white/28">{p.r}</div>
                            </div>
                            {p.target
                              ? <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(10,102,194,0.2)', color: '#70b5f9', border: '1px solid rgba(10,102,194,0.3)' }}>Target contact</span>
                              : <button className="text-[9px] text-white/30 border border-white/[0.10] px-2.5 py-0.5 rounded-full shrink-0 hover:border-white/25">+ Connect</button>
                            }
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── GOOGLE SEARCH ── */}
                {phase === 'websearch' && (
                  <div className="p-5" style={{ background: '#202124' }}>
                    {/* Google logo */}
                    <div className="flex justify-center mb-5">
                      <span className="text-[30px] font-bold" style={{ fontFamily: 'arial, sans-serif', letterSpacing: '-0.5px' }}>
                        <span style={{ color: '#8ab4f8' }}>G</span>
                        <span style={{ color: '#f28b82' }}>o</span>
                        <span style={{ color: '#fdd663' }}>o</span>
                        <span style={{ color: '#8ab4f8' }}>g</span>
                        <span style={{ color: '#81c995' }}>l</span>
                        <span style={{ color: '#f28b82' }}>e</span>
                      </span>
                    </div>

                    {/* Search bar */}
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-full mb-4" style={{ background: '#303134', border: '1px solid #5f6368' }}>
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#9aa0a6" strokeWidth={2.2}>
                        <circle cx="11" cy="11" r="8"/>
                        <path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
                      </svg>
                      <span className="text-[13px] flex-1" style={{ color: '#e8eaed', fontFamily: 'arial, sans-serif' }}>
                        {SEARCH_QUERY.slice(0, queryIdx)}
                        {queryIdx < SEARCH_QUERY.length && <span className="inline-block w-px h-[13px] animate-pulse align-text-bottom ml-px" style={{ background: '#8ab4f8' }} />}
                      </span>
                    </div>

                    {/* Tabs */}
                    {subStep >= 1 && (
                      <div className="flex items-center gap-1 text-[11px] mb-3" style={{ borderBottom: '1px solid #3c4043' }}>
                        {['All', 'News', 'Images', 'Videos'].map((t, i) => (
                          <div key={t} className="px-3 py-2 cursor-pointer" style={i === 0 ? { color: '#8ab4f8', borderBottom: '2px solid #8ab4f8' } : { color: '#bdc1c6' }}>{t}</div>
                        ))}
                      </div>
                    )}

                    {subStep >= 1 && (
                      <div className="text-[11px] mb-3 px-1" style={{ color: '#bdc1c6', fontFamily: 'arial, sans-serif' }}>
                        About 8,420 results <span style={{ color: '#9aa0a6' }}>(0.31 seconds)</span>
                      </div>
                    )}

                    {subStep >= 1 && (
                      <div className="space-y-5 px-1">
                        {SEARCH_RESULTS.slice(0, webResults).map((r, i) => (
                          <div key={i} className={`slide-up rounded-lg p-2.5 transition-all ${subStep >= 2 && r.hi ? 'ring-1' : ''}`} style={subStep >= 2 && r.hi ? { background: 'rgba(138,180,248,0.06)', ring: '1px solid rgba(138,180,248,0.2)' } : {}}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-4 h-4 rounded-sm flex items-center justify-center text-[7px] font-black shrink-0" style={{ background: '#303134', color: '#bdc1c6' }}>
                                {r.url.includes('techcrunch') ? 'TC' : r.url.includes('linkedin') ? 'in' : 'F'}
                              </div>
                              <span className="text-[11px] truncate" style={{ color: '#bdc1c6', fontFamily: 'arial, sans-serif' }}>{r.url}</span>
                            </div>
                            <div className="text-[14px] font-medium leading-snug mb-1 cursor-pointer hover:underline" style={{ color: '#8ab4f8', fontFamily: 'arial, sans-serif' }}>{r.title}</div>
                            <div className="text-[12px] leading-relaxed" style={{ color: '#bdc1c6', fontFamily: 'arial, sans-serif' }}>{r.snippet}</div>
                            {subStep >= 2 && r.hi && (
                              <div className="mt-2 text-[10px] flex items-center gap-1.5" style={{ color: '#81c995' }}>
                                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#81c995' }} />Opening article…
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── TECHCRUNCH ARTICLE ── */}
                {phase === 'article' && (
                  <div className="p-6 space-y-4">
                    {/* TechCrunch header */}
                    <div className="flex items-center gap-3 -mx-6 -mt-6 px-5 py-2.5 mb-4" style={{ background: '#0a0a0a', borderBottom: '1px solid #333' }}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded flex items-center justify-center font-black text-[11px]" style={{ background: '#0d9b25', color: 'white' }}>TC</div>
                        <span className="font-black text-[13px]" style={{ color: '#0d9b25', fontFamily: 'helvetica, arial, sans-serif' }}>TechCrunch</span>
                      </div>
                      <div className="ml-auto flex items-center gap-3 text-[10px] text-white/25">
                        <span>Startups</span><span>Venture</span><span>AI</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white/35">STARTUPS</span>
                      <span className="text-[10px] text-white/20">· 3 days ago</span>
                    </div>
                    <h3 className="text-white/88 font-black text-[16px] leading-snug" style={{ fontFamily: 'helvetica, arial, sans-serif' }}>ScaleFlow raises $12M Series A to triple US outbound sales capacity</h3>
                    <div className="space-y-3.5">
                      {ARTICLE_PARAS.map((para, i) => (
                        <ArticlePara key={i} text={para} state={i < artPara ? 'past' : i === artPara ? 'current' : 'future'} setRef={el => { paraElems.current[i] = el }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── GMAIL COMPOSE ── */}
                {(phase === 'email' || phase === 'done') && (
                  <div className="flex flex-col min-h-full" style={{ background: '#1c1c1c' }}>
                    {/* Gmail header bar */}
                    <div className="flex items-center px-4 py-2 shrink-0" style={{ background: '#3c4043' }}>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: '#EA4335' }}>
                          <span className="text-white font-black text-[9px]">M</span>
                        </div>
                        <span className="text-[12px] font-medium" style={{ color: '#e8eaed' }}>New Message</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {['—', '⤢', '×'].map(icon => (
                          <button key={icon} className="w-5 h-5 rounded flex items-center justify-center text-[11px]" style={{ color: '#bdc1c6' }}>{icon}</button>
                        ))}
                      </div>
                    </div>

                    {/* To / Subject fields */}
                    <div style={{ borderBottom: '1px solid #3c4043' }}>
                      {[
                        { l: 'To',      v: 'sarah@scaleflow.io',          style: { color: '#8ab4f8' } },
                        { l: 'Subject', v: "ScaleFlow's Q3 SDR expansion", style: { color: '#e8eaed' } },
                      ].map(f => (
                        <div key={f.l} className="flex items-center px-4 py-2" style={{ borderBottom: '1px solid #3c4043' }}>
                          <span className="text-[12px] w-14 shrink-0" style={{ color: '#9aa0a6' }}>{f.l}</span>
                          <span className="text-[12px]" style={f.style}>{f.v}</span>
                          {f.l === 'To' && <span className="ml-auto text-[10px]" style={{ color: '#8ab4f8' }}>Cc Bcc</span>}
                        </div>
                      ))}
                    </div>

                    {/* Body */}
                    <div className="flex-1 px-4 py-3">
                      <div className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: '#e8eaed', fontFamily: 'arial, sans-serif' }}>
                        {phase === 'done' ? EMAIL_BODY : EMAIL_BODY.slice(0, typed)}
                        {phase === 'email' && typed < EMAIL_BODY.length && <span className="inline-block w-px h-[13px] animate-pulse align-text-bottom ml-px" style={{ background: '#8ab4f8' }} />}
                      </div>
                    </div>

                    {/* Gmail toolbar */}
                    <div className="flex items-center gap-1 px-3 py-2 shrink-0" style={{ background: '#1c1c1c', borderTop: '1px solid #3c4043' }}>
                      <button
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium transition-all"
                        style={{ background: phase === 'done' ? '#1a73e8' : 'rgba(26,115,232,0.35)', color: phase === 'done' ? 'white' : 'rgba(255,255,255,0.35)' }}
                      >
                        Send {phase === 'done' && <ArrowRight className="w-3 h-3" />}
                      </button>
                      <div className="flex items-center gap-0.5 ml-2" style={{ color: '#9aa0a6' }}>
                        {['B', 'I', 'U'].map(t => (
                          <button key={t} className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold hover:bg-white/10">{t}</button>
                        ))}
                        <div className="w-px h-4 mx-1" style={{ background: '#3c4043' }} />
                        <button className="w-6 h-6 rounded flex items-center justify-center text-[12px] hover:bg-white/10">≡</button>
                        <button className="w-6 h-6 rounded flex items-center justify-center text-[11px] hover:bg-white/10">@</button>
                      </div>
                      {phase === 'done' && (
                        <span className="ml-auto text-[11px] flex items-center gap-1.5" style={{ color: '#81c995' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#81c995', display: 'inline-block' }} />Ready to send
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ── RESEARCH REPORT ── */}
                {phase === 'report' && (
                  <div className="p-6 space-y-5">
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
                              <span className={`text-[9px] shrink-0 ${sec.accent ? 'text-green-400' : 'text-indigo-400'}`}>→</span>{item}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ── HUBSPOT CRM ── */}
                {phase === 'crm' && (
                  <div className="overflow-hidden">
                    {/* HubSpot nav */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]" style={{ background: '#1a1410' }}>
                      {/* HubSpot sprocket */}
                      <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
                        <circle cx="50" cy="50" r="18" fill="#FF7A59"/>
                        <rect x="43" y="2" width="14" height="22" rx="7" fill="#FF7A59"/>
                        <rect x="43" y="76" width="14" height="22" rx="7" fill="#FF7A59"/>
                        <rect x="2" y="43" width="22" height="14" rx="7" fill="#FF7A59"/>
                        <rect x="76" y="43" width="22" height="14" rx="7" fill="#FF7A59"/>
                        <rect x="15" y="15" width="14" height="22" rx="7" fill="#FF7A59" transform="rotate(-45 22 26)"/>
                        <rect x="15" y="63" width="14" height="22" rx="7" fill="#FF7A59" transform="rotate(45 22 74)"/>
                        <rect x="63" y="15" width="14" height="22" rx="7" fill="#FF7A59" transform="rotate(45 70 26)"/>
                        <rect x="63" y="63" width="14" height="22" rx="7" fill="#FF7A59" transform="rotate(-45 70 74)"/>
                      </svg>
                      <span className="text-[12px] font-bold" style={{ color: '#FF7A59' }}>HubSpot</span>
                      <span className="text-white/15 text-[11px] mx-1">/</span>
                      <span className="text-[11px] text-white/35">CRM</span>
                      <span className="text-white/15 text-[11px] mx-1">/</span>
                      <span className="text-[11px] text-white/35">Contacts</span>
                      <span className="text-white/15 text-[11px] mx-1">/</span>
                      <span className="text-[11px]" style={{ color: '#FF7A59' }}>Sarah Chen</span>
                    </div>

                    {/* Contact header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0" style={{ background: 'rgba(255,122,89,0.15)', border: '1px solid rgba(255,122,89,0.3)', color: '#FF7A59' }}>SC</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white/85 font-bold text-[14px]">Sarah Chen</div>
                        <div className="text-white/35 text-[11px]">Head of Growth · ScaleFlow</div>
                      </div>
                      <button className="px-3 py-1.5 rounded text-white text-[10px] font-bold shrink-0" style={{ background: '#FF7A59' }}>+ Enroll in Sequence</button>
                    </div>

                    {/* Deal stage pipeline */}
                    <div className="px-4 py-3 border-b border-white/[0.06]">
                      <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2.5">Deal Stage</div>
                      <div className="flex gap-1">
                        {['Prospect', 'Contacted', 'Meeting', 'Proposal', 'Closed'].map((stage, i) => (
                          <div key={stage} className="flex-1 py-1.5 text-center text-[9px] font-bold rounded transition-all" style={i <= 1 ? { background: '#FF7A59', color: 'white' } : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}>
                            {stage}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Properties */}
                    <div className="px-4 py-3">
                      <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2.5">Contact Properties</div>
                      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                        {CRM_FIELDS.map((f, i) => (
                          <div key={f.label} className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.05] last:border-0 transition-all duration-300 ${crmField > i ? 'opacity-100' : 'opacity-20'}`}>
                            <span className="text-white/28 text-[11px] w-18 shrink-0">{f.label}</span>
                            <span className={`text-[12px] font-medium flex-1 ${crmField > i ? 'text-white/70' : 'text-white/10'}`}>{crmField > i ? f.value : '—'}</span>
                            {crmField > i && <span className="ml-auto text-[9px]" style={{ color: 'rgba(255,122,89,0.6)' }}>✓</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sync bar */}
                    {crmField >= CRM_FIELDS.length && (
                      <div className="px-4 pb-3">
                        <div className="flex justify-between text-[10px] text-white/25 mb-1.5">
                          <span>Syncing to HubSpot</span>
                          <span style={{ color: '#FF7A59' }}>{crmBar === 100 ? '100%' : '…'}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${crmBar}%`, background: '#FF7A59', transition: 'width 1.0s ease-out' }} />
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {crmActions > 0 && (
                      <div className="px-4 pb-4 space-y-2">
                        {CRM_ACTIONS.slice(0, crmActions).map((action, i) => (
                          <div key={i} className="slide-up flex items-center gap-2 text-[12px]" style={{ color: 'rgba(255,122,89,0.8)' }}>
                            <span className="text-[10px]">✓</span>{action}
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
                    <span className="text-indigo-400">✦</span>Research Notes
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
