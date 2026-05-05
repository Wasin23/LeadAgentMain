'use client';

import React, { useEffect, useRef, useState } from 'react';
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

  const words = ['Meridian', 'runs', '24/7.'];

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center text-center px-6">
      <h1 ref={titleRef} className="overflow-hidden mb-6">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          {words.map((word, wi) => (
            <span key={wi} className="overflow-hidden inline-block">
              {word.split('').map((ch, ci) => (
                <span key={ci} className="char inline-block text-6xl md:text-8xl font-black tracking-tight text-white">
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </div>
      </h1>

      <div ref={subtitleRef} className="space-y-2 mb-10">
        <p className="line text-xl text-white/50 max-w-xl">
          AI agents that research leads and write personalized emails
        </p>
        <p className="line text-xl text-white/50 max-w-xl">
          — sent from your own inbox, automatically.
        </p>
      </div>

      <div className="flex gap-4">
        <Link href="/signin" className="group flex items-center gap-2 px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-white/90 transition-all hover:scale-105">
          Start free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>
        <button className="px-8 py-4 border border-white/20 hover:border-white/50 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 backdrop-blur-sm bg-white/5">
          Learn More
        </button>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 text-xs tracking-widest uppercase">
        <span>Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </div>
  );
}
