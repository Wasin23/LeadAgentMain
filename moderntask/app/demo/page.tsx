'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const HorizonHero = dynamic(() => import('@/components/demo/horizon-hero').then(m => ({ default: m.HorizonHero })), { ssr: false, loading: () => <Loading label="Loading Horizon…" /> });
const GlobeHero = dynamic(() => import('@/components/demo/globe-hero').then(m => ({ default: m.GlobeHero })), { ssr: false, loading: () => <Loading label="Loading Globe Hero…" /> });
const ScrollGlobe = dynamic(() => import('@/components/demo/scroll-globe').then(m => ({ default: m.ScrollGlobe })), { ssr: false, loading: () => <Loading label="Loading ScrollGlobe…" /> });
const ProspectGlobe = dynamic(() => import('@/components/demo/prospect-globe').then(m => ({ default: m.ProspectGlobe })), { ssr: false, loading: () => <Loading label="Loading Prospect Globe…" /> });

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-screen bg-black text-white/40 text-sm">
      {label}
    </div>
  );
}

type Demo = 'horizon' | 'globe' | 'scroll' | 'prospects';

const DEMOS: { id: Demo; label: string; desc: string }[] = [
  { id: 'prospects', label: '🛰 Prospect Globe', desc: 'Geolocation → globe → animated lead beams' },
  { id: 'horizon', label: '🌌 Horizon', desc: 'Three.js stars, nebula & mountains with GSAP scroll' },
  { id: 'globe',   label: '🔮 Globe Hero', desc: 'React Three Fiber wireframe globe' },
  { id: 'scroll',  label: '🌍 ScrollGlobe', desc: 'CSS rotating Earth with scroll sections' },
];

export default function DemoPage() {
  const [active, setActive] = useState<Demo>('prospects');

  return (
    <div className="relative">
      {/* Sticky switcher bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2 flex-wrap">
          <span className="text-white/40 text-xs font-mono mr-2 flex-shrink-0">21st.dev demos →</span>
          {DEMOS.map(d => (
            <button
              key={d.id}
              onClick={() => setActive(d.id)}
              title={d.desc}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                active === d.id
                  ? 'bg-white text-black'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              )}
            >
              {d.label}
            </button>
          ))}
          <span className="ml-auto text-white/20 text-xs hidden md:block">
            {DEMOS.find(d => d.id === active)?.desc}
          </span>
        </div>
      </div>

      {/* Component */}
      <div className="pt-[52px]">
        {active === 'prospects' && <ProspectGlobe />}
        {active === 'horizon'   && <HorizonHero />}
        {active === 'globe'     && <GlobeHero />}
        {active === 'scroll'    && <ScrollGlobe />}
      </div>
    </div>
  );
}
