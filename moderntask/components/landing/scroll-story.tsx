'use client'

import { useEffect, useRef, useState, RefObject } from 'react'
import Link from 'next/link'
import { ArrowRight, Target, Search, FileText, Send, CheckCircle, Eye, Clock, Reply } from 'lucide-react'
import { StarField } from '@/components/landing/star-field'

// ─── Constants ────────────────────────────────────────────────────────────────

const NYC   = { lat: 40.7128, lng: -74.006 }
const C_LAT = NYC.lat * Math.PI / 180
const C_LNG = NYC.lng * Math.PI / 180

const LEADS = [
  { id: 0, name: 'Alex Morgan',   title: 'Head of Growth',  company: 'Foresight AI', lat: 42.36, lng: -71.06, delay: 1.0 },
  { id: 1, name: 'Rachel Torres', title: 'CRO',             company: 'Stackline',    lat: 39.95, lng: -75.17, delay: 1.1 },
  { id: 2, name: 'Marcus Hill',   title: 'VP Sales',        company: 'GovTech',      lat: 38.91, lng: -77.04, delay: 1.2 },
  { id: 3, name: 'Claire Weber',  title: 'Founder',         company: 'DataBridge',   lat: 39.29, lng: -76.61, delay: 1.3 },
  { id: 4, name: 'Nate Collins',  title: 'CEO',             company: 'Prism Health', lat: 41.76, lng: -72.68, delay: 1.4 },
  { id: 5, name: 'Lisa Park',     title: 'Head of Revenue', company: 'Relay',        lat: 41.82, lng: -71.41, delay: 1.5 },
]

const PIPELINE_STEPS = [
  { icon: Target,      label: 'Prospect found',       desc: 'Matched your ICP from 50M+ companies' },
  { icon: Search,      label: 'Account researched',   desc: 'Signals, context, and role-fit pulled' },
  { icon: FileText,    label: 'Email drafted',        desc: 'Written from real account context' },
  { icon: CheckCircle, label: 'You approve',          desc: 'Review manually or auto-approve' },
  { icon: Send,        label: 'Sent from your inbox', desc: 'Gmail or Outlook, your real domain' },
  { icon: Eye,         label: 'Opens tracked',        desc: 'Know exactly when they read it' },
  { icon: Clock,       label: 'Follow-up queued',     desc: 'Smart timing, stops on reply' },
  { icon: Reply,       label: 'Reply lands',          desc: 'Sequence stops, reply routes to you' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function project(lat: number, lng: number, gcx: number, gcy: number, gr: number, rot: number) {
  const latR = lat * Math.PI / 180
  const lngR = lng * Math.PI / 180
  const dLng = lngR - C_LNG - rot
  const cosC = Math.sin(C_LAT) * Math.sin(latR) + Math.cos(C_LAT) * Math.cos(latR) * Math.cos(dLng)
  if (cosC < 0.04) return null
  return {
    x: gcx + gr * Math.cos(latR) * Math.sin(dLng),
    y: gcy - gr * (Math.cos(C_LAT) * Math.sin(latR) - Math.sin(C_LAT) * Math.cos(latR) * Math.cos(dLng)),
    depth: cosC,
  }
}

// ─── Globe canvas hook ────────────────────────────────────────────────────────

function useGlobeCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf: number, t = 0

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const W = canvas.width, H = canvas.height
      t += 0.004
      ctx.clearRect(0, 0, W, H)

      const GCX = W * 0.58
      const GCY = H * 0.52
      const GR  = Math.min(H * 0.62, W * 0.52)
      const ROT = 0

      // Globe body
      ctx.save()
      ctx.beginPath()
      ctx.arc(GCX, GCY, GR, 0, Math.PI * 2)
      ctx.clip()

      ctx.fillStyle = '#04112a'
      ctx.fillRect(0, 0, W, H)

      const hx = GCX - GR * 0.28, hy = GCY - GR * 0.20
      const gb = ctx.createRadialGradient(hx, hy, 0, hx, hy, GR * 1.2)
      gb.addColorStop(0,   'rgba(50,100,240,0.50)')
      gb.addColorStop(0.5, 'rgba(15,50,160,0.22)')
      gb.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.fillStyle = gb
      ctx.fillRect(0, 0, W, H)

      // Latitude lines
      ;[-60,-45,-30,-15,0,15,30,45,60].forEach(deg => {
        const lat = deg * Math.PI / 180
        const cL = Math.cos(lat), sL = Math.sin(lat)
        ctx.beginPath()
        for (let k = 0; k <= 80; k++) {
          const a = (k / 80) * Math.PI * 2
          ctx.lineTo(GCX + GR * cL * Math.cos(a), GCY + GR * sL + GR * cL * Math.sin(a) * 0.22)
        }
        ctx.strokeStyle = 'rgba(100,155,255,0.13)'
        ctx.lineWidth = 0.6
        ctx.stroke()
      })

      // Meridian lines
      for (let i = 0; i < 18; i++) {
        const theta = (i / 18) * Math.PI * 2 + ROT
        const sT = Math.sin(theta), cT = Math.cos(theta)
        const front = cT > 0
        ctx.beginPath()
        for (let j = 0; j <= 64; j++) {
          const phi = (j / 64) * Math.PI * 2
          ctx.lineTo(GCX + GR * Math.cos(phi) * sT, GCY + GR * Math.sin(phi))
        }
        ctx.strokeStyle = `rgba(100,165,255,${front ? 0.07 + 0.20 * Math.abs(sT) : 0.015})`
        ctx.lineWidth = front ? 0.5 + 0.55 * Math.abs(sT) : 0.3
        ctx.stroke()
      }
      ctx.restore()

      // Atmosphere
      const atmo = ctx.createRadialGradient(GCX, GCY, GR * 0.92, GCX, GCY, GR * 1.14)
      atmo.addColorStop(0,    'rgba(60,120,255,0)')
      atmo.addColorStop(0.45, 'rgba(70,150,255,0.16)')
      atmo.addColorStop(1,    'rgba(40,100,255,0)')
      ctx.beginPath()
      ctx.arc(GCX, GCY, GR * 1.14, 0, Math.PI * 2)
      ctx.fillStyle = atmo
      ctx.fill()

      const nycP = project(NYC.lat, NYC.lng, GCX, GCY, GR, ROT)

      // Pre-compute all projections/progress for label suppression
      const allProj = LEADS.map(l => project(l.lat, l.lng, GCX, GCY, GR, ROT))
      const allProg = LEADS.map(l => Math.min(Math.max(0, t - l.delay) / 1.2, 1))
      const margin = 40

      // Beams + lead markers
      LEADS.forEach((lead, i) => {
        const leadP = allProj[i]
        const prog  = allProg[i]
        if (prog <= 0 || !leadP || !nycP) return
        if (leadP.x < margin || leadP.x > W - margin || leadP.y < margin || leadP.y > H - margin) return

        const tipX = nycP.x + (leadP.x - nycP.x) * prog
        const tipY = nycP.y + (leadP.y - nycP.y) * prog

        ctx.beginPath()
        ctx.moveTo(nycP.x, nycP.y)
        ctx.lineTo(tipX, tipY)
        ctx.strokeStyle = prog >= 1 ? 'rgba(60,140,255,0.35)' : 'rgba(100,190,255,0.90)'
        ctx.lineWidth   = prog >= 1 ? 1.2 : 1.8
        ctx.stroke()

        if (prog < 1) {
          const dg = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 10)
          dg.addColorStop(0, 'rgba(180,220,255,0.9)')
          dg.addColorStop(1, 'rgba(60,140,255,0)')
          ctx.beginPath()
          ctx.arc(tipX, tipY, 10, 0, Math.PI * 2)
          ctx.fillStyle = dg
          ctx.fill()
          ctx.beginPath()
          ctx.arc(tipX, tipY, 2.5, 0, Math.PI * 2)
          ctx.fillStyle = '#b0d8ff'
          ctx.fill()
        }

        if (prog >= 1) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + i)
          const rp    = (t * 1.4 + i * 0.28) % 1

          const lg = ctx.createRadialGradient(leadP.x, leadP.y, 0, leadP.x, leadP.y, 18)
          lg.addColorStop(0, `rgba(100,255,150,${pulse * 0.75})`)
          lg.addColorStop(1, 'rgba(50,200,100,0)')
          ctx.beginPath()
          ctx.arc(leadP.x, leadP.y, 18, 0, Math.PI * 2)
          ctx.fillStyle = lg
          ctx.fill()

          ctx.beginPath()
          ctx.arc(leadP.x, leadP.y, 4 + rp * 14, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(80,220,130,${0.6 * (1 - rp)})`
          ctx.lineWidth = 1
          ctx.stroke()

          ctx.beginPath()
          ctx.arc(leadP.x, leadP.y, 4, 0, Math.PI * 2)
          ctx.fillStyle = '#4ade80'
          ctx.fill()

          const nm  = lead.name
          const sub = `${lead.title} · ${lead.company}`
          ctx.font = '600 11px ui-sans-serif,system-ui,sans-serif'
          const tw = Math.max(ctx.measureText(nm).width, ctx.measureText(sub).width) + 20
          // suppress label if too close to an earlier completed lead
          const suppressed = allProj.some((p, j) => {
            if (j >= i || !p || allProg[j] < 1) return false
            return Math.hypot(p.x - leadP.x, p.y - leadP.y) < 100
          })
          if (!suppressed) {
            const ly = leadP.y + 4
            const lx = (leadP.x + tw + 20 > W - 20) ? leadP.x - tw - 16 : leadP.x + 10
            ctx.fillStyle = 'rgba(4,8,28,0.88)'
            if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(lx - 2, ly - 16, tw, 34, 5) }
            else                { ctx.beginPath(); ctx.rect(lx - 2, ly - 16, tw, 34) }
            ctx.fill()
            ctx.strokeStyle = 'rgba(99,102,241,0.30)'
            ctx.lineWidth = 0.7
            ctx.stroke()
            ctx.fillStyle = '#d4d8ff'
            ctx.fillText(nm, lx + 7, ly)
            ctx.font = '400 9.5px ui-sans-serif,system-ui,sans-serif'
            ctx.fillStyle = '#7880aa'
            ctx.fillText(sub, lx + 7, ly + 13)
          }
        }
      })

      // NYC node
      if (nycP) {
        const op = 0.55 + 0.45 * Math.sin(t * 2.6)
        const og = ctx.createRadialGradient(nycP.x, nycP.y, 0, nycP.x, nycP.y, 32)
        og.addColorStop(0, `rgba(160,140,255,${op * 0.65})`)
        og.addColorStop(1, 'rgba(99,102,241,0)')
        ctx.beginPath()
        ctx.arc(nycP.x, nycP.y, 32, 0, Math.PI * 2)
        ctx.fillStyle = og
        ctx.fill()

        for (let r = 0; r < 2; r++) {
          const rp = ((t * 1.3 + r * 0.5) % 1)
          ctx.beginPath()
          ctx.arc(nycP.x, nycP.y, 5 + rp * 26, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(150,130,255,${0.6 * (1 - rp)})`
          ctx.lineWidth = 1.2
          ctx.stroke()
        }

        ctx.beginPath()
        ctx.arc(nycP.x, nycP.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()

        ctx.font = '600 10px ui-sans-serif,system-ui,sans-serif'
        ctx.fillStyle = 'rgba(180,190,255,0.65)'
        ctx.fillText('New York City', nycP.x + 8, nycP.y - 6)
      }

      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [canvasRef])
}

// ─── Scroll-section wrapper ───────────────────────────────────────────────────

function useScrollPct(ref: RefObject<HTMLDivElement | null>) {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const el = ref.current
      if (!el) return
      const top   = el.getBoundingClientRect().top
      const total = el.offsetHeight - window.innerHeight
      setPct(Math.min(Math.max(-top / total, 0), 1))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ref])
  return pct
}

// ─── Globe section layout ─────────────────────────────────────────────────────

function GlobeSection({ children }: { children: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useGlobeCanvas(canvasRef)
  return (
    <div className="sticky top-0 h-screen overflow-hidden bg-[#03050d]">
      <StarField />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ background: 'transparent' }} />
      <div className="absolute inset-0 z-10 flex items-center">
        <div className="w-[46%] px-12 xl:px-20">
          {children}
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-black/22 text-[10px] tracking-widest uppercase select-none pointer-events-none">
        <span>scroll</span>
        <div className="w-px h-10 bg-gradient-to-b from-white/22 to-transparent" />
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScrollStory() {
  const ref1 = useRef<HTMLDivElement>(null)
  const ref2 = useRef<HTMLDivElement>(null)
  const pct1 = useScrollPct(ref1)
  const pct2 = useScrollPct(ref2)

  return (
    <>
      {/* ── Page 1 - How the agent finds prospects ── */}
      <div ref={ref1} style={{ height: '200vh' }}>
        <GlobeSection>
          <p className="text-indigo-400/80 text-xs font-semibold tracking-[0.2em] uppercase mb-5">
            How Meridian works
          </p>
          <h2 className="text-[clamp(1.9rem,3.2vw,3.4rem)] font-black text-gray-900 leading-[1.04] mb-5">
            Your agent finds 50 new qualified prospects every morning.
          </h2>
          <p className="text-black/45 text-[1.05rem] leading-relaxed mb-10 max-w-md">
            Define your ICP once. Meridian scans companies, scores by fit, researches each account, and hands you a live prospect list - fully automated.
          </p>
          <div className="space-y-5">
            {[
              { icon: Target,   step: '① Define your ICP',          desc: 'Industry, title, company size, tech stack - as specific as you need.' },
              { icon: Search,   step: '② Agent scans for matches',   desc: 'Funding rounds, hiring spikes, product launches, LinkedIn signals.' },
              { icon: FileText, step: '③ Research and rank',         desc: 'Scores each prospect by fit and intent, pulls context for the email.' },
              { icon: Send,     step: '④ Always-on sourcing',        desc: 'New leads surface every day. No spreadsheets, no manual list-building.' },
            ].map(({ icon: Icon, step, desc }, i) => (
              <div
                key={step}
                className="flex gap-4 items-start transition-all duration-500"
                style={{
                  opacity:   pct1 > i * 0.2 ? 1 : 0,
                  transform: `translateY(${pct1 > i * 0.2 ? 0 : 16}px)`,
                }}
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-black/85 text-sm font-semibold mb-0.5">{step}</p>
                  <p className="text-black/38 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </GlobeSection>
      </div>

      {/* ── Page 2 - The email ── */}
      <div ref={ref2} style={{ height: '200vh' }}>
        <GlobeSection>
          <p className="text-indigo-400/80 text-xs font-semibold tracking-[0.2em] uppercase mb-5">
            The email
          </p>
          <h2 className="text-[clamp(1.9rem,3.2vw,3.4rem)] font-black text-gray-900 leading-[1.04] mb-4">
            One personalized email per prospect. Written from research.
          </h2>
          <p className="text-black/45 text-base leading-relaxed mb-7 max-w-[400px]">
            Not a template with a name token. Every email is written from account context - funding, hiring signals, product news, and role-specific hooks.
          </p>
          <div className="space-y-3 max-w-[430px]">
            {[
              {
                to:      'sarah@scaleflow.io',
                subject: "Growing ScaleFlow's outbound without adding headcount",
                tag:     'Growth · SaaS',
                preview: 'Saw ScaleFlow is hiring 3 SDRs while expanding into the US. That usually means outbound volume is the blocker, not budget…',
              },
              {
                to:      'james@finova.io',
                subject: "Outbound infrastructure for Finova's Series A push",
                tag:     'Post-funding · Fintech',
                preview: "Congrats on the $12M raise. Post-Series A usually means you're building out GTM fast and need pipeline to show up for the board…",
              },
            ].map((email, i) => (
              <div
                key={email.to}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-4 transition-all duration-500"
                style={{
                  opacity:   pct2 > i * 0.35 ? 1 : 0,
                  transform: `translateY(${pct2 > i * 0.35 ? 0 : 12}px)`,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5 text-[11px]">
                  <span className="text-indigo-400 font-medium">To:</span>
                  <span className="text-black/50">{email.to}</span>
                  <span className="ml-auto rounded-full bg-indigo-500/20 text-indigo-300/80 px-2 py-0.5 text-[10px] font-medium">
                    {email.tag}
                  </span>
                </div>
                <p className="text-black/80 text-xs font-semibold mb-1.5 leading-snug">{email.subject}</p>
                <p className="text-black/32 text-[11px] leading-relaxed line-clamp-2">{email.preview}</p>
              </div>
            ))}
          </div>
        </GlobeSection>
      </div>

      {/* ── Section C - Full pipeline ── */}
      <div className="relative overflow-hidden bg-[#03050d]">
        <StarField />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(60,80,220,0.12),transparent)]" />
        <div className="relative max-w-6xl mx-auto px-6 sm:px-10 py-28 xl:py-36 z-10">
          <div className="text-center mb-20">
            <p className="text-indigo-400/80 text-xs font-semibold tracking-[0.2em] uppercase mb-5">
              The full loop
            </p>
            <h2 className="text-4xl sm:text-5xl xl:text-6xl font-black text-gray-900 leading-[1.04] mb-5">
              Prospect to pipeline,<br className="hidden sm:block" /> fully automated.
            </h2>
            <p className="text-black/40 text-lg leading-relaxed max-w-xl mx-auto">
              From the moment a prospect is found to the moment a reply lands in your inbox - Meridian handles every step.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 xl:gap-5">
            {PIPELINE_STEPS.map(({ icon: Icon, label, desc }, i) => (
              <div
                key={label}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 group hover:border-indigo-500/30 hover:bg-indigo-500/[0.04] transition-all duration-300"
              >
                <div className="text-[10px] font-bold text-indigo-400/45 tracking-widest uppercase mb-4">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/12 border border-indigo-500/20 flex items-center justify-center mb-4 group-hover:bg-indigo-500/18 transition-all">
                  <Icon className="w-4 h-4 text-indigo-300" />
                </div>
                <p className="text-black/85 text-sm font-semibold mb-1">{label}</p>
                <p className="text-black/35 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-xl transition-all hover:scale-[1.03]"
            >
              Start free with 250 credits <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-black/25 text-sm mt-3">No credit card. Gmail and Outlook supported.</p>
          </div>
        </div>
      </div>
    </>
  )
}
