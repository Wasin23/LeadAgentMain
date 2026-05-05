'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ArrowRight } from 'lucide-react'

// ── Canvas Globe ───────────────────────────────────────────────────────────
function GlobeGraphic() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf: number
    let t = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      t += 0.003
      ctx.clearRect(0, 0, W, H)

      const cx = W * 0.5
      const cy = H * 0.5
      const R = Math.min(W, H) * 0.42

      const TILT = 20 * Math.PI / 180
      const cosA = Math.cos(TILT)
      const sinA = Math.sin(TILT)
      const proj = (x3: number, y3: number): [number, number] => [
        cx + R * (x3 * cosA - y3 * sinA),
        cy - R * (x3 * sinA + y3 * cosA),
      ]

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()

      const body = ctx.createRadialGradient(cx + R * 0.20, cy - R * 0.35, R * 0.05, cx, cy, R)
      body.addColorStop(0, '#1e4898')
      body.addColorStop(0.25, '#0e1f6a')
      body.addColorStop(0.55, '#07133a')
      body.addColorStop(1, '#010510')
      ctx.fillStyle = body
      ctx.fillRect(0, 0, W, H)

      // latitude lines
      const LAT_COUNT = 13
      const sinMax = Math.sin(80 * Math.PI / 180)
      const lats = Array.from({ length: LAT_COUNT }, (_, i) => {
        const s = -sinMax + (i / (LAT_COUNT - 1)) * 2 * sinMax
        return Math.asin(s) * 180 / Math.PI
      })
      for (const deg of lats) {
        const lat = (deg * Math.PI) / 180
        const cosLat = Math.cos(lat)
        const sinLat = Math.sin(lat)
        for (let pass = 0; pass < 2; pass++) {
          const aStart = pass === 0 ? Math.PI / 2 : -Math.PI / 2
          const aEnd = pass === 0 ? Math.PI * 3 / 2 : Math.PI / 2
          ctx.beginPath()
          const steps = 64
          for (let k = 0; k <= steps; k++) {
            const alpha = aStart + (aEnd - aStart) * (k / steps)
            const [sx, sy] = proj(cosLat * Math.sin(alpha), sinLat)
            k === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)
          }
          ctx.strokeStyle = pass === 0 ? 'rgba(100,150,255,0.07)' : 'rgba(100,150,255,0.25)'
          ctx.lineWidth = pass === 0 ? 0.7 : 1.0
          ctx.stroke()
        }
      }

      // meridian lines
      const NUM = 20
      const SEGS = 80
      for (let i = 0; i < NUM; i++) {
        const theta = (i / NUM) * Math.PI * 2 + t
        const sinT = Math.sin(theta)
        const cosT = Math.cos(theta)
        const isFront = cosT > 0
        const alpha = isFront ? 0.12 + 0.55 * Math.abs(sinT) : 0.03 + 0.06 * Math.abs(sinT)
        ctx.beginPath()
        for (let j = 0; j <= SEGS; j++) {
          const phi = (j / SEGS) * Math.PI - Math.PI / 2
          const [sx, sy] = proj(Math.cos(phi) * sinT, Math.sin(phi))
          j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)
        }
        ctx.strokeStyle = `rgba(100,150,255,${alpha})`
        ctx.lineWidth = isFront ? 0.8 + 1.0 * Math.abs(sinT) : 0.4
        ctx.stroke()
      }

      ctx.restore()

      // atmosphere glow ring
      const atmo = ctx.createRadialGradient(cx, cy, R * 0.93, cx, cy, R * 1.08)
      atmo.addColorStop(0, 'rgba(60,100,255,0)')
      atmo.addColorStop(0.4, 'rgba(80,140,255,0.28)')
      atmo.addColorStop(1, 'rgba(40,80,255,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2)
      ctx.fillStyle = atmo
      ctx.fill()

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  )
}

// ── CRM panel ─────────────────────────────────────────────────────────────
const CONTACTS = [
  { name: 'Sarah Chen',  company: 'ScaleFlow',  role: 'Head of Growth',  stage: 'Contacted',  fit: 94 },
  { name: 'Marcus Lee',  company: 'Finova',     role: 'VP of Sales',     stage: 'Interested', fit: 88 },
  { name: 'Jade Morris', company: 'FleetGrid',  role: 'Head of Revenue', stage: 'New',        fit: 91 },
  { name: 'Tom Reyes',   company: 'LayerStack', role: 'CEO',             stage: 'New',        fit: 86 },
  { name: 'Nina Patel',  company: 'StitchOps',  role: 'VP Finance',      stage: 'New',        fit: 79 },
]

const CRM_UPDATES = [
  { field: 'Last researched', value: 'Just now' },
  { field: 'Email status',    value: 'Opened 3× · no reply yet' },
  { field: 'Deal stage',      value: 'New → Contacted' },
  { field: 'Intent signals',  value: 'Hiring 3 SDRs · Series A' },
  { field: 'Next action',     value: 'Follow-up: SDR expansion angle' },
]

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }
type CrmPhase = 'scanning' | 'researching' | 'updating' | 'done'

function CrmPanel() {
  const [phase, setPhase]     = useState<CrmPhase>('scanning')
  const [scanIdx, setScanIdx] = useState(-1)
  const [fields, setFields]   = useState(0)
  const alive                 = useRef(true)

  useEffect(() => {
    alive.current = true
    const run = async () => {
      setPhase('scanning'); setScanIdx(-1); setFields(0)
      for (let i = 0; i < CONTACTS.length; i++) {
        if (!alive.current) return
        setScanIdx(i); await sleep(300)
      }
      if (!alive.current) return
      await sleep(250); setPhase('researching')
      await sleep(900); if (!alive.current) return
      setPhase('updating')
      for (let i = 0; i < CRM_UPDATES.length; i++) {
        if (!alive.current) return
        setFields(i + 1); await sleep(460)
      }
      if (!alive.current) return
      setPhase('done'); await sleep(2200)
      if (!alive.current) return
      run()
    }
    run()
    return () => { alive.current = false }
  }, [])

  const stageColor: Record<string, string> = {
    'New': 'bg-white/10 text-white/40',
    'Contacted': 'bg-indigo-500/20 text-indigo-400',
    'Interested': 'bg-green-500/20 text-green-400',
  }

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-[#06081a]/95 backdrop-blur-2xl overflow-hidden shadow-2xl shadow-black/70 ring-1 ring-white/[0.05]">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 px-3 py-[3px] rounded bg-white/[0.05] border border-white/[0.06] text-white/20 text-[10px] font-mono text-center truncate">
          meridian://crm/contacts
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${phase === 'done' ? 'bg-green-400' : 'bg-indigo-400 animate-pulse'}`} />
          <span className={`text-[10px] font-medium ${phase === 'done' ? 'text-green-400' : 'text-indigo-400/80'}`}>
            {phase === 'scanning' ? 'Scanning…' : phase === 'researching' ? 'Researching…' : phase === 'updating' ? 'Updating CRM…' : 'Updated'}
          </span>
        </div>
      </div>

      <div className="flex" style={{ height: 380 }}>
        <div className="w-[185px] shrink-0 border-r border-white/[0.06] overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-bold text-white/25 uppercase tracking-widest border-b border-white/[0.04]">
            Contacts · {CONTACTS.length}
          </div>
          {CONTACTS.map((c, i) => (
            <div key={i} className={`px-3 py-2.5 border-b border-white/[0.03] transition-all ${
              i === 0 && phase !== 'scanning' ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500'
              : scanIdx === i ? 'bg-white/[0.04]' : ''
            }`}>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-[9px] font-bold shrink-0">{c.name[0]}</div>
                <div className="min-w-0">
                  <div className={`text-[11px] font-semibold truncate ${i === 0 && phase !== 'scanning' ? 'text-white/85' : 'text-white/45'}`}>{c.name}</div>
                  <div className="text-[9px] text-white/22 truncate">{c.company}</div>
                </div>
              </div>
              {scanIdx === i && phase === 'scanning' && (
                <div className="mt-1 h-px bg-indigo-500/50 rounded animate-pulse" />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 p-5 overflow-y-auto">
          {phase === 'scanning' ? (
            <div className="h-full flex items-center justify-center text-[12px] text-white/15 italic">Select a contact</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-sm shrink-0">S</div>
                <div>
                  <div className="text-white/85 font-bold text-sm">Sarah Chen</div>
                  <div className="text-white/35 text-[11px]">Head of Growth · ScaleFlow</div>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className={`px-1.5 py-px rounded text-[9px] font-semibold ${stageColor['Contacted']}`}>Contacted</span>
                    <span className="px-1.5 py-px rounded text-[9px] font-semibold bg-white/[0.06] text-white/40">Fit 94%</span>
                  </div>
                </div>
              </div>
              {phase === 'researching' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                  AI researching account signals…
                </div>
              )}
              {(phase === 'updating' || phase === 'done') && (
                <div className="space-y-2 border-t border-white/[0.06] pt-3">
                  <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">AI Updates</div>
                  {CRM_UPDATES.slice(0, fields).map((u, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <span className="text-green-400 text-[10px] mt-px shrink-0">✓</span>
                      <span className="text-white/30 w-28 shrink-0">{u.field}</span>
                      <span className="text-white/65 font-medium">{u.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {phase === 'done' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-[11px] text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  CRM record updated · next action queued
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main section ───────────────────────────────────────────────────────────
export function GlobeCrmSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [prog, setProg] = useState(0)

  useEffect(() => {
    let sectionTop = 0
    const cacheTop = () => {
      const s = sectionRef.current
      if (s) sectionTop = s.getBoundingClientRect().top + window.scrollY
    }
    cacheTop()
    const onScroll = () => {
      const s = sectionRef.current
      if (!s) return
      const p = Math.min(Math.max((window.scrollY - sectionTop) / Math.max(s.offsetHeight - window.innerHeight, 1), 0), 1)
      setProg(p)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', cacheTop)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', cacheTop)
    }
  }, [])

  const showCrm = prog > 0.4

  return (
    <div ref={sectionRef} className="relative z-10" style={{ height: '380vh' }}>
      <div className="sticky top-0 h-screen overflow-hidden">

        {/* The globe — one big circle */}
        <GlobeGraphic />

        {/* Top fade */}
        <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-b from-[#03050d] to-transparent pointer-events-none z-10" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#03050d] to-transparent pointer-events-none z-10" />

        {/* Outbound content */}
        <div
          className="absolute top-0 left-0 z-20 px-14 pt-28 max-w-[480px] transition-all duration-500"
          style={{ opacity: showCrm ? 0 : 1, transform: showCrm ? 'translateY(-16px)' : 'none', pointerEvents: showCrm ? 'none' : 'auto' }}
        >
          <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-5">
            Sends. Tracks.<br />Follows up.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-7 max-w-[400px]">
            Every email fires from your real inbox. Opens tracked, follow-ups scheduled automatically, and when a reply lands — all sequences stop instantly.
          </p>
          <div className="space-y-3">
            {[
              'Sends from Gmail or Outlook — your real domain',
              'Open and click tracking per email',
              'Smart follow-ups — pause on reply, resume on silence',
              'Every reply routes back to your inbox',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-white/55 text-[15px]">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* CRM content */}
        {showCrm && (
          <div
            className="absolute inset-0 z-20 flex items-center px-10 gap-12"
            style={{ animation: 'fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards' }}
          >
            <div className="max-w-[360px]">
              <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.05] tracking-tight mb-4">
                Keeps your CRM<br />up to date.
              </h2>
              <p className="text-white/50 text-base leading-relaxed mb-6">
                Every time Meridian researches a lead or gets a reply, your CRM updates automatically — deal stage, last contact, next action, signals from the web.
              </p>
              <div className="space-y-2.5 mb-8">
                {[
                  'Auto-updates deal stage on reply',
                  'Enriches contacts with live web signals',
                  'Queues next actions automatically',
                  'Syncs with HubSpot, Salesforce, and more',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-white/50 text-[14px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/signin" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105">
                Start free <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex-1 max-w-[520px]">
              <CrmPanel />
            </div>
          </div>
        )}

        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    </div>
  )
}
