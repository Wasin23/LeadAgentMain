'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Section = {
  id: string;
  badge: string;
  title: string;
  subtitle?: string;
  description: string;
  align?: 'left' | 'center' | 'right';
  features?: { title: string; description: string }[];
  actions?: { label: string; variant: 'primary' | 'secondary'; href?: string }[];
};

const SECTIONS: Section[] = [
  {
    id: 'hero',
    badge: 'Welcome',
    title: 'Your AI',
    subtitle: 'Outreach Team',
    description:
      'Meridian agents research every lead, write personalized emails, and send from your real inbox — all on autopilot. No shared domains. No templates.',
    align: 'left',
    actions: [
      { label: 'Start free', variant: 'primary', href: '/signin' },
      { label: 'See how it works', variant: 'secondary' },
    ],
  },
  {
    id: 'research',
    badge: 'Lead Research',
    title: 'Every email starts',
    subtitle: 'with research.',
    description:
      'Before writing a single word, Meridian scours company websites, hiring signals, news, and LinkedIn to find the angle that actually lands.',
    align: 'center',
    features: [
      { title: 'Company & role intelligence', description: 'Hiring patterns, funding rounds, tech stack, recent news' },
      { title: 'Signal-based targeting', description: 'Reach leads when they\'re most likely to respond' },
    ],
  },
  {
    id: 'sending',
    badge: 'Real Inbox',
    title: 'Sends from',
    subtitle: 'your Gmail or Outlook.',
    description:
      'Connect your real inbox via OAuth. Emails land in your Sent folder, replies come back to you. No shared domain, no spam folder.',
    align: 'left',
    features: [
      { title: 'Gmail & Outlook OAuth', description: 'Send from your actual email address' },
      { title: 'LinkedIn outreach', description: 'InMail and connection requests for top-rated leads' },
      { title: 'Auto follow-ups', description: 'Sequences stop the moment a lead replies' },
    ],
  },
  {
    id: 'cta',
    badge: 'Get Started',
    title: 'Start your free',
    subtitle: 'trial today.',
    description: '250 credits, no credit card. Set up your first agent in under 10 minutes.',
    align: 'center',
    actions: [
      { label: 'Create free account', variant: 'primary', href: '/signin' },
    ],
  },
];

const GLOBE_POSITIONS = [
  { top: 50, left: 72, scale: 1.4 },
  { top: 20, left: 50, scale: 1.0 },
  { top: 55, left: 78, scale: 1.8 },
  { top: 50, left: 50, scale: 2.2 },
];

export function ScrollGlobe() {
  const [activeSection, setActiveSection] = useState(0);
  const [globeTransform, setGlobeTransform] = useState('');
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);

  const positions = useMemo(() => GLOBE_POSITIONS, []);

  const update = useCallback(() => {
    const viewportCenter = window.innerHeight / 2;
    let nearest = 0;
    let minDist = Infinity;
    sectionRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const d = Math.abs(rect.top + rect.height / 2 - viewportCenter);
      if (d < minDist) { minDist = d; nearest = i; }
    });
    setActiveSection(nearest);
    const p = positions[nearest];
    setGlobeTransform(
      `translate3d(${p.left}vw, ${p.top}vh, 0) translate3d(-50%, -50%, 0) scale(${p.scale})`
    );
  }, [positions]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        rafRef.current = requestAnimationFrame(() => { update(); ticking = false; });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(rafRef.current); };
  }, [update]);

  return (
    <div className="relative w-full bg-background text-foreground overflow-x-hidden">
      {/* Rotating CSS globe */}
      <div
        className="fixed z-0 pointer-events-none transition-all duration-[1200ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{ transform: globeTransform }}
      >
        <style>{`
          @keyframes earthRotate { 0% { background-position: 0 0; } 100% { background-position: 400px 0; } }
          @keyframes twinkle { 0%,100% { opacity:0.1 } 50% { opacity:1 } }
        `}</style>
        <div
          className="relative w-[280px] h-[280px] rounded-full overflow-hidden"
          style={{
            boxShadow: '0 0 30px rgba(99,102,241,0.15), -5px 0 12px #c3f4ff inset, 15px 2px 30px #000 inset, -20px -2px 30px rgba(195,244,255,0.4) inset, 200px 0 44px rgba(0,0,0,0.4) inset',
            backgroundImage: "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/globe.jpeg')",
            backgroundSize: 'cover',
            backgroundPosition: 'left',
            animation: 'earthRotate 28s linear infinite',
          }}
        >
          {[
            { left: '-20px', top: '10px', delay: '0s' },
            { left: '-40px', top: '50px', delay: '1s' },
            { left: '290px', top: '70px', delay: '0.5s' },
            { left: '200px', top: '280px', delay: '1.5s' },
          ].map((s, i) => (
            <div key={i} className="absolute w-1 h-1 bg-white rounded-full"
              style={{ left: s.left, top: s.top, animation: `twinkle 3s ${s.delay} infinite` }} />
          ))}
        </div>
      </div>

      {/* Side nav dots */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-4">
        {SECTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            title={s.badge}
            className={cn(
              'w-2.5 h-2.5 rounded-full border-2 transition-all duration-300',
              activeSection === i
                ? 'bg-primary border-primary scale-125'
                : 'bg-transparent border-muted-foreground/40 hover:border-primary/60'
            )}
          />
        ))}
      </div>

      {/* Sections */}
      {SECTIONS.map((section, i) => (
        <section
          key={section.id}
          ref={(el) => { sectionRefs.current[i] = el as HTMLDivElement | null; }}
          className={cn(
            'relative min-h-screen flex flex-col justify-center px-8 md:px-16 z-20 py-20',
            section.align === 'center' && 'items-center text-center',
            section.align === 'right' && 'items-end text-right',
          )}
        >
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-widest uppercase mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {section.badge}
            </div>

            <h2 className="text-5xl md:text-6xl font-black tracking-tight leading-tight mb-2 text-foreground">
              {section.title}
            </h2>
            {section.subtitle && (
              <h2 className="text-5xl md:text-6xl font-black tracking-tight leading-tight mb-6 text-muted-foreground/60">
                {section.subtitle}
              </h2>
            )}
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">{section.description}</p>

            {section.features && (
              <div className="space-y-3 mb-8">
                {section.features.map((f, fi) => (
                  <div key={fi} className="flex items-start gap-3 p-4 rounded-xl border bg-card/50 hover:bg-card transition-all">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">{f.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {section.actions && (
              <div className={cn('flex flex-wrap gap-3', section.align === 'center' && 'justify-center')}>
                {section.actions.map((a, ai) => (
                  a.href ? (
                    <Link key={ai} href={a.href}
                      className={cn('flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105',
                        a.variant === 'primary'
                          ? 'bg-primary text-primary-foreground shadow-lg hover:bg-primary/90'
                          : 'border border-border bg-background hover:bg-accent'
                      )}>
                      {a.label} {a.variant === 'primary' && <ArrowRight className="w-4 h-4" />}
                    </Link>
                  ) : (
                    <button key={ai}
                      className={cn('flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105',
                        a.variant === 'primary'
                          ? 'bg-primary text-primary-foreground shadow-lg hover:bg-primary/90'
                          : 'border border-border bg-background hover:bg-accent'
                      )}>
                      {a.label}
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
