'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

// ── types ──────────────────────────────────────────────────────────────────
type Phase =
  | 'idle'
  | 'to-leads'
  | 'pickup'
  | 'to-research'
  | 'researching'
  | 'pickup-enriched'
  | 'to-crm'
  | 'deposit'

// ── data ───────────────────────────────────────────────────────────────────
const LEADS_QUEUE = [
  { name: 'Sarah Chen',  co: 'ScaleFlow',   role: 'Head of Growth'  },
  { name: 'Marcus Lee',  co: 'Finova',      role: 'VP of Sales'     },
  { name: 'Jade Morris', co: 'FleetGrid',   role: 'Head of Revenue' },
  { name: 'Tom Reyes',   co: 'LayerStack',  role: 'CEO'             },
  { name: 'Nina Patel',  co: 'StitchOps',   role: 'VP Finance'      },
]

const ARTICLE_PARAS = [
  'ScaleFlow announced a $12M Series A led by Sequoia Capital, with plans to triple headcount by Q3 — specifically hiring outbound sales infrastructure and senior SDRs.',
  'Head of Growth Sarah Chen noted the team needs outbound tooling that "researches the account and writes a real email" rather than generic sequences.',
  'The company grew 340% ARR in Q4, expanding from 60 to 200+ revenue teams across 18 countries with a new enterprise motion focused on B2B SaaS.',
]

const SIGNALS = [
  { label: 'Series A closed',        value: '$12M · Sequoia'            },
  { label: 'Hiring 3 Senior SDRs',   value: 'posted 4 days ago'         },
  { label: 'Headcount',              value: '12 → 35 by Q3'             },
  { label: 'Intent signal',          value: 'Outbound tooling research'  },
]

const CRM_ENRICHED = [
  { name: 'Lena Kwon',   co: 'Driftwork',  fit: 91 },
  { name: 'Alex Park',   co: 'Vantara',    fit: 88 },
  { name: 'Chris Mao',   co: 'Buildbase',  fit: 85 },
]

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── tiny scan-text ──────────────────────────────────────────────────────────
function ScanLine({ text, active, done }: { text: string; active: boolean; done: boolean }) {
  const words = useMemo(() => text.split(' '), [text])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!active) { setIdx(done ? words.length + 1 : 0); return }
    setIdx(0)
    let i = 0
    const t = setInterval(() => { i++; setIdx(i); if (i >= words.length) clearInterval(t) }, 1000 / 55)
    return () => clearInterval(t)
  }, [active, done, words.length])

  return (
    <p className={`text-[10.5px] leading-[1.7] transition-opacity duration-300 ${!active && !done ? 'opacity-20' : 'opacity-100'}`}>
      {done ? (
        <span className="text-white/55">{text}</span>
      ) : (
        words.map((w, i) => (
          <span key={i}>
            <span className={
              i < idx   ? 'text-white/55' :
              i === idx ? 'bg-indigo-500/30 text-white/90 rounded-sm px-0.5' :
              'text-white/20'
            }>{w}</span>
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))
      )}
    </p>
  )
}

// ── agent bot SVG ───────────────────────────────────────────────────────────
function AgentBot({ carrying, enriched }: { carrying: boolean; enriched: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* card being carried */}
      {carrying && (
        <div
          className="rounded border px-2 py-1 text-[9px] font-semibold mb-0.5 transition-all"
          style={{
            background: enriched ? 'rgba(74,222,128,0.12)' : 'rgba(99,102,241,0.12)',
            borderColor: enriched ? 'rgba(74,222,128,0.4)' : 'rgba(99,102,241,0.4)',
            color: enriched ? 'rgba(74,222,128,0.9)' : 'rgba(165,180,252,0.9)',
            minWidth: 64,
            textAlign: 'center',
          }}
        >
          {enriched ? '✦ Enriched' : 'Lead'}
        </div>
      )}
      {/* bot body */}
      <svg width="36" height="42" viewBox="0 0 36 42" fill="none">
        {/* head */}
        <rect x="8" y="2" width="20" height="16" rx="4" fill="#1e2a5e" stroke="rgba(99,102,241,0.7)" strokeWidth="1.2"/>
        {/* eyes */}
        <circle cx="13" cy="10" r="2.5" fill="rgba(129,140,248,0.9)"/>
        <circle cx="23" cy="10" r="2.5" fill="rgba(129,140,248,0.9)"/>
        {/* antenna */}
        <line x1="18" y1="2" x2="18" y2="-2" stroke="rgba(99,102,241,0.6)" strokeWidth="1.2"/>
        <circle cx="18" cy="-3" r="1.5" fill="rgba(99,102,241,0.8)"/>
        {/* neck */}
        <rect x="15" y="18" width="6" height="3" fill="#1e2a5e"/>
        {/* body */}
        <rect x="6" y="21" width="24" height="14" rx="3" fill="#1a2356" stroke="rgba(99,102,241,0.5)" strokeWidth="1.2"/>
        {/* chest light */}
        <circle cx="18" cy="28" r="3" fill="rgba(99,102,241,0.4)" stroke="rgba(129,140,248,0.6)" strokeWidth="0.8"/>
        {/* arms */}
        <rect x="0" y="22" width="6" height="3" rx="1.5" fill="#1e2a5e" stroke="rgba(99,102,241,0.4)" strokeWidth="0.8"/>
        <rect x="30" y="22" width="6" height="3" rx="1.5" fill="#1e2a5e" stroke="rgba(99,102,241,0.4)" strokeWidth="0.8"/>
        {/* legs */}
        <rect x="9"  y="35" width="7" height="7" rx="2" fill="#1e2a5e" stroke="rgba(99,102,241,0.4)" strokeWidth="0.8"/>
        <rect x="20" y="35" width="7" height="7" rx="2" fill="#1e2a5e" stroke="rgba(99,102,241,0.4)" strokeWidth="0.8"/>
      </svg>
    </div>
  )
}

// ── stations ────────────────────────────────────────────────────────────────
function LeadsPile({ active, leadIdx }: { active: boolean; leadIdx: number }) {
  const remaining = LEADS_QUEUE.slice(leadIdx % LEADS_QUEUE.length)
  return (
    <div className="flex flex-col items-center gap-2 w-[140px]">
      <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 transition-colors ${active ? 'text-indigo-400' : 'text-white/25'}`}>
        Leads queue
      </div>
      <div className="relative w-full">
        {[...remaining].reverse().slice(0, 4).map((l, i) => (
          <div
            key={i}
            className="rounded-lg border border-white/[0.08] bg-[#0a0e24] px-3 py-2 absolute w-full transition-all"
            style={{ bottom: i * 6, zIndex: i, opacity: 0.4 + i * 0.15 }}
          >
            <div className="text-[10px] font-semibold text-white/60">{l.name}</div>
            <div className="text-[9px] text-white/25">{l.co}</div>
          </div>
        ))}
        <div className="h-[72px]" />
      </div>
    </div>
  )
}

function ResearchStation({ phase, paraIdx }: { phase: Phase; paraIdx: number }) {
  const active = phase === 'researching'
  const signalsShown = active ? Math.min(SIGNALS.length, paraIdx + 1) : 0

  return (
    <div className={`flex flex-col gap-2 w-[260px] transition-all duration-500 ${active ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 transition-colors ${active ? 'text-indigo-400' : 'text-white/25'}`}>
        Research station
      </div>
      {/* article pane */}
      <div className="rounded-xl border border-white/[0.08] bg-[#080c20] p-3 space-y-2">
        <div className={`text-[9px] font-mono truncate transition-colors ${active ? 'text-indigo-400/70' : 'text-white/15'}`}>
          {active ? '⟳ scaleflow.com/blog/series-a' : '── waiting ──'}
        </div>
        {ARTICLE_PARAS.map((para, i) => (
          <ScanLine
            key={i}
            text={para}
            active={active && paraIdx === i}
            done={active && paraIdx > i}
          />
        ))}
      </div>
      {/* signals pane */}
      {signalsShown > 0 && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05] p-3 space-y-1.5">
          <div className="text-[9px] font-bold text-indigo-400/60 uppercase tracking-widest mb-1">Signals found</div>
          {SIGNALS.slice(0, signalsShown).map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-white/40">{s.label}</span>
              <span className="text-indigo-300/80 font-medium">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CrmBase({ enrichedCount }: { enrichedCount: number }) {
  const visible = [...CRM_ENRICHED, ...LEADS_QUEUE.map(l => ({ name: l.name, co: l.co, fit: Math.floor(80 + Math.random() * 18) }))]
    .slice(0, enrichedCount)
    .reverse()
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-2 w-[150px]">
      <div className="text-[10px] font-bold uppercase tracking-widest mb-1 text-white/25">
        CRM base
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-[#080c20] overflow-hidden">
        <div className="px-3 py-1.5 border-b border-white/[0.05] text-[9px] text-white/20 font-mono">
          {enrichedCount} enriched
        </div>
        {visible.length === 0 && (
          <div className="px-3 py-4 text-[9px] text-white/15 italic text-center">empty</div>
        )}
        {visible.map((l, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04] last:border-0">
            <div>
              <div className="text-[10px] font-semibold text-white/70">{l.name}</div>
              <div className="text-[9px] text-white/25">{l.co}</div>
            </div>
            <div className="text-[9px] font-bold text-green-400">{l.fit}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── main viz ────────────────────────────────────────────────────────────────
const PHASE_X: Record<Phase, number> = {
  'idle':             6,
  'to-leads':         82,
  'pickup':           82,
  'to-research':      44,
  'researching':      44,
  'pickup-enriched':  44,
  'to-crm':           6,
  'deposit':          6,
}

const PHASE_DURATIONS: Partial<Record<Phase, number>> = {
  'to-leads':    850,
  'pickup':      400,
  'to-research': 850,
  'researching': 5200,
  'pickup-enriched': 350,
  'to-crm':      850,
  'deposit':     500,
}

function CrmViz() {
  const [phase, setPhase]               = useState<Phase>('idle')
  const [agentX, setAgentX]             = useState(6)
  const [carrying, setCarrying]         = useState(false)
  const [carryingEnriched, setCarryingEnriched] = useState(false)
  const [leadIdx, setLeadIdx]           = useState(0)
  const [enrichedCount, setEnrichedCount] = useState(CRM_ENRICHED.length)
  const [paraIdx, setParaIdx]           = useState(-1)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true

    const go = async () => {
      while (alive.current) {
        // idle pause
        await sleep(900)
        if (!alive.current) return

        // move to leads
        setPhase('to-leads'); setAgentX(PHASE_X['to-leads'])
        await sleep(PHASE_DURATIONS['to-leads']!)

        // pickup
        setPhase('pickup'); setCarrying(true); setCarryingEnriched(false)
        await sleep(PHASE_DURATIONS['pickup']!)

        // move to research
        setPhase('to-research'); setAgentX(PHASE_X['to-research'])
        await sleep(PHASE_DURATIONS['to-research']!)

        // drop off + research
        setPhase('researching'); setCarrying(false); setParaIdx(0)
        await sleep(1600)
        if (!alive.current) return
        setParaIdx(1)
        await sleep(1800)
        if (!alive.current) return
        setParaIdx(2)
        await sleep(1600)
        if (!alive.current) return

        // pick up enriched
        setPhase('pickup-enriched'); setCarrying(true); setCarryingEnriched(true)
        await sleep(PHASE_DURATIONS['pickup-enriched']!)

        // move to CRM
        setPhase('to-crm'); setAgentX(PHASE_X['to-crm'])
        await sleep(PHASE_DURATIONS['to-crm']!)

        // deposit
        setPhase('deposit')
        setCarrying(false); setCarryingEnriched(false)
        setEnrichedCount(c => c + 1)
        setLeadIdx(i => i + 1)
        setParaIdx(-1)
        await sleep(PHASE_DURATIONS['deposit']!)

        setPhase('idle')
      }
    }
    go()
    return () => { alive.current = false }
  }, [])

  const isCarrying  = carrying
  const isEnriched  = carryingEnriched

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#05070f] overflow-hidden shadow-2xl shadow-black/60">
      {/* titlebar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.06] bg-[#05070f]">
        <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
        <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
        <div className="w-2 h-2 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] text-white/20 font-mono">meridian · ai agent</span>
        <span className="ml-auto text-[9px] text-indigo-400/60 font-mono">
          {phase === 'researching' ? '⟳ researching…' : phase === 'to-leads' ? '→ fetching lead' : phase === 'to-crm' ? '→ updating CRM' : phase === 'idle' ? '● ready' : '···'}
        </span>
      </div>

      {/* track */}
      <div className="relative px-4 py-5" style={{ height: 88 }}>
        {/* dashed track line */}
        <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 border-t border-dashed border-white/[0.08]" />

        {/* station markers */}
        {[
          { x: '6%',  label: 'CRM'      },
          { x: '44%', label: 'Research'  },
          { x: '82%', label: 'Leads'     },
        ].map(s => (
          <div key={s.label} className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1" style={{ left: s.x }}>
            <div className="w-2 h-2 rounded-full bg-white/15" />
          </div>
        ))}

        {/* agent */}
        <div
          className="absolute top-1/2 -translate-y-[60%] -translate-x-1/2 transition-all"
          style={{ left: `${agentX}%`, transitionDuration: phase === 'to-leads' || phase === 'to-research' || phase === 'to-crm' ? '850ms' : '300ms', transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)' }}
        >
          <AgentBot carrying={isCarrying} enriched={isEnriched} />
        </div>
      </div>

      {/* stations */}
      <div className="px-4 pb-5 flex items-start justify-between gap-3">
        <CrmBase enrichedCount={enrichedCount} />
        <ResearchStation phase={phase} paraIdx={paraIdx} />
        <LeadsPile active={phase === 'to-leads' || phase === 'pickup'} leadIdx={leadIdx} />
      </div>
    </div>
  )
}

// ── section ─────────────────────────────────────────────────────────────────
export function CrmPipelineSection() {
  return (
    <section className="relative z-10 py-28 px-6">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-center gap-16">

        <div className="flex-1 max-w-[420px] shrink-0">
          <p className="text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-4">CRM Intelligence</p>
          <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
            Researches every<br />lead. Automatically.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-8">
            Meridian's AI agent pulls each lead, finds live signals — funding rounds, job posts, news — then enriches your CRM before it ever hits your inbox.
          </p>
          <div className="space-y-3 mb-10">
            {[
              'Pulls leads from your queue automatically',
              'Finds live signals: funding, hiring, intent',
              'Enriches each record before outreach',
              'Syncs back to HubSpot, Salesforce, and more',
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

        <div className="flex-1 w-full min-w-0">
          <CrmViz />
        </div>

      </div>
    </section>
  )
}
