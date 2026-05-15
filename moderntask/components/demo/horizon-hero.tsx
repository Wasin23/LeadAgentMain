'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export function HorizonHero() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => { setIsReady(true); }, []);

  useEffect(() => {
    if (!isReady || !titleRef.current || !subtitleRef.current) return;
    const tl = gsap.timeline();
    tl.from(titleRef.current.querySelectorAll('.char'), {
      y: 120, opacity: 0, duration: 1.2, stagger: 0.04, ease: 'power4.out',
    }).from(subtitleRef.current.querySelectorAll('.line'), {
      y: 40, opacity: 0, duration: 0.9, stagger: 0.15, ease: 'power3.out',
    }, '-=0.6');
    return () => { tl.kill(); };
  }, [isReady]);

  const words = ['Outbound,', 'fully', 'automated.'];

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center text-center px-6">

      {/* tight glow behind the headline */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[700px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.18) 0%, rgba(79,70,229,0.08) 45%, transparent 70%)' }} />

      <h1 ref={titleRef} className="overflow-hidden mb-6 md:mb-8 relative z-10 px-2">
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 md:gap-x-6 md:gap-y-2">
          {words.map((word, wi) => (
            <span key={wi} className="overflow-hidden inline-block pb-3">
              {word.split('').map((ch, ci) => (
                <span key={ci} className="char inline-block text-4xl sm:text-6xl md:text-8xl font-black tracking-tight text-white">
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </div>
      </h1>

      <div ref={subtitleRef} className="space-y-1.5 mb-8 md:mb-10 relative z-10 px-4">
        <p className="line text-sm sm:text-lg md:text-xl text-white/50">Runs 24/7. Multi-agent. Fully personalized.</p>
        <p className="line text-sm sm:text-lg md:text-xl text-white/50 max-w-xl mx-auto">Researches leads, writes emails, sends from your inbox, follows up automatically.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 relative z-10 items-center">
        <Link href="/signin" className="group flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white text-black rounded-xl font-bold text-base sm:text-lg hover:bg-white/90 transition-all hover:scale-105"
          style={{ boxShadow: '0 0 40px rgba(255,255,255,0.15), 0 4px 24px rgba(0,0,0,0.4)' }}>
          Start free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('carousel-advance'))}
          className="px-6 sm:px-8 py-3 sm:py-4 text-white rounded-xl font-semibold text-base sm:text-lg transition-all hover:scale-105 backdrop-blur-sm"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.3)' }}
        >
          Learn More
        </button>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 text-xs tracking-widest uppercase z-10">
        <span>Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </div>
  );
}
