'use client'

import Link from 'next/link'
import { ArrowRight, ChevronDown, Loader2 } from 'lucide-react'
import { useState } from 'react'

const FAQ = [
  {
    q: 'What counts as a credit?',
    a: 'Each lead researched and emailed consumes credits based on depth of research. A standard send (profile lookup + email write + send) uses roughly 1 credit. Deep research (LinkedIn scan + web search + article read) uses 2–4 credits per lead.',
  },
  {
    q: 'Can I use my own inbox?',
    a: 'Yes — Meridian connects to Gmail or Outlook via OAuth. Every email sends from your actual address, your actual domain. There are no shared sending pools and no ESP subdomains.',
  },
  {
    q: 'What happens when someone replies?',
    a: 'The moment a reply lands, all follow-up sequences for that contact stop automatically. The reply routes directly to your inbox like any other email — no platform middleman.',
  },
  {
    q: 'Is the Enterprise plan customizable?',
    a: 'Yes. The $2,500/month tier is the starting point for teams that need higher volume, custom concurrency, dedicated onboarding, or bespoke integrations. Reach out and we\'ll scope it from there.',
  },
  {
    q: 'How does agent research actually work?',
    a: 'Agents pull from Apollo for lead sourcing, then independently search the web, scan LinkedIn signals, and read recent news before writing. Nothing is templated — each email is written from the research gathered on that specific account.',
  },
  {
    q: 'Can multiple reps share one account?',
    a: 'Yes — the Teams plan lets you invite members, each with their own connected inbox and agent assignments. Pipeline visibility is shared, but sends go out from each rep\'s own address.',
  },
]

function InquiryForm() {
  const [form, setForm]     = useState({ name: '', email: '', company: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setStatus(res.ok ? 'sent' : 'error')
    } catch {
      setStatus('error')
    }
  }

  const inputCls = 'w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.10] text-white/80 text-[13px] placeholder:text-white/20 focus:outline-none focus:border-indigo-500/60 transition-colors'

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 sticky top-8">
      <p className="text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-4">Enterprise</p>
      <h3 className="text-xl font-black text-white mb-2">Need something custom?</h3>
      <p className="text-white/40 text-[13px] leading-relaxed mb-6">
        Higher volume, custom integrations, or dedicated onboarding — send us a note and we'll scope it together.
      </p>

      {status === 'sent' ? (
        <div className="rounded-xl border border-green-500/25 bg-green-500/[0.08] px-5 py-6 text-center">
          <div className="text-green-400 text-[22px] mb-2">✓</div>
          <p className="text-white/70 text-[14px] font-semibold">Message received</p>
          <p className="text-white/35 text-[12px] mt-1">We'll get back to you within 1 business day.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Name" value={form.name} onChange={set('name')} className={inputCls} />
            <input required type="email" placeholder="Work email" value={form.email} onChange={set('email')} className={inputCls} />
          </div>
          <input placeholder="Company (optional)" value={form.company} onChange={set('company')} className={inputCls} />
          <textarea
            required
            rows={4}
            placeholder="What are you looking to do? Volume, team size, integrations..."
            value={form.message}
            onChange={set('message')}
            className={`${inputCls} resize-none`}
          />
          {status === 'error' && (
            <p className="text-red-400/80 text-[12px]">Something went wrong — try emailing hello@usemeridian.com directly.</p>
          )}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-[14px] transition-all hover:scale-[1.02] disabled:hover:scale-100"
          >
            {status === 'sending' ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <>Send message <ArrowRight className="w-4 h-4" /></>}
          </button>
          <div className="pt-1 space-y-2">
            {['Response within 1 business day', 'No sales call required', 'Custom credit volumes available'].map(t => (
              <div key={t} className="flex items-center gap-2 text-[11px] text-white/28">
                <span className="w-1 h-1 rounded-full bg-indigo-400/50 shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </form>
      )}
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left group"
      >
        <span className="text-[14px] font-semibold text-white/75 group-hover:text-white/90 transition-colors">
          {q}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-white/30 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="pb-4 text-[13px] text-white/45 leading-relaxed pr-8">
          {a}
        </p>
      )}
    </div>
  )
}

export function FooterSection() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] min-h-screen flex flex-col">

      {/* FAQ + inquiry */}
      <div className="flex-1 px-6 sm:px-12 py-20">
        <div className="max-w-5xl mx-auto">

          <div className="flex flex-col lg:flex-row gap-16">

            {/* left: FAQ */}
            <div className="flex-1">
              <p className="text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-4">FAQ</p>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-8">
                Common questions.
              </h2>
              <div>
                {FAQ.map(item => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>

            {/* right: inquiry form */}
            <div className="lg:w-[360px] shrink-0">
              <InquiryForm />
            </div>

          </div>
        </div>
      </div>

      {/* CTA band */}
      <div className="border-t border-white/[0.06] flex flex-col items-center justify-center px-6 sm:px-12 py-20 text-center">
        <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">
          Start with 250 free credits.
        </h2>
        <p className="text-white/45 text-lg max-w-lg mx-auto mb-8">
          Connect your inbox, define your audience, and launch a real outbound workflow — no credit card, no bloated sales stack.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <Link
            href="/signin"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-white/90 transition-all hover:scale-105"
          >
            Start free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 text-[13px] text-white/25">
          {['No credit card', 'Gmail and Outlook', 'Manual review or auto-send', 'Replies tracked automatically'].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-white/20" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* bottom bar */}
      <div className="border-t border-white/[0.05] px-6 sm:px-12 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <svg width="22" height="22" viewBox="0 0 48 48" fill="none" className="text-white/40">
              <ellipse cx="24" cy="24" rx="6"  ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="14" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="20" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="8"  stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="24" cy="24" rx="20" ry="16" stroke="currentColor" strokeWidth="1.5" />
              <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-white/35 text-sm font-medium">Meridian</span>
          </div>
          <p className="text-white/20 text-[12px]">© {new Date().getFullYear()} Meridian. All rights reserved.</p>
          <div className="flex items-center gap-5 text-[12px] text-white/30">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
            <Link href="/terms"   className="hover:text-white/60 transition-colors">Terms of Service</Link>
            <span className="text-white/15">™</span>
          </div>
        </div>
      </div>

    </footer>
  )
}
