'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function FooterSection() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06]">
      {/* CTA band */}
      <div className="px-6 sm:px-12 py-28 text-center">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mb-4">
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

      {/* Footer links */}
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

          <p className="text-white/20 text-[12px]">
            © {new Date().getFullYear()} Meridian. All rights reserved.
          </p>

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
