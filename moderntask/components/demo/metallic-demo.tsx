'use client';

import { useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

// Brushed-gunmetal gradient built from the app's own primary hue (oklch(0.3 0.04 158))
// instead of generic silver/chrome, so it reads as "this app's metal" not a stock effect.
const METAL_GRADIENT =
  'linear-gradient(135deg, #171d1a 0%, #3a463d 18%, #5b6e60 32%, #232b26 46%, #6e8274 60%, #1a211d 74%, #4a5a4e 88%, #222a25 100%)';

function useTiltHighlight() {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ '--mx': '50%', '--my': '50%' } as CSSProperties);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    setStyle({ '--mx': `${mx}%`, '--my': `${my}%` } as CSSProperties);
  };

  return { ref, style, onMouseMove };
}

function MetallicCard({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, style, onMouseMove } = useTiltHighlight();

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className={cn('relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl animate-metallic-drift', className)}
      style={{ ...style, backgroundImage: METAL_GRADIENT, backgroundSize: '320% 320%' }}
    >
      {/* cursor-tracked specular highlight */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ background: 'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,0.30), transparent 42%)' }}
      />
      {/* idle looping diagonal sheen */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-metallic-sweep" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function MetallicButton({ children }: { children: ReactNode }) {
  const [sweep, setSweep] = useState(0);
  return (
    <button
      onMouseEnter={() => setSweep(s => s + 1)}
      className="relative overflow-hidden rounded-xl px-6 py-3 text-sm font-medium text-white/95 border border-white/15 shadow-lg animate-metallic-drift"
      style={{ backgroundImage: METAL_GRADIENT, backgroundSize: '320% 320%' }}
    >
      <span
        key={sweep}
        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-metallic-sweep-fast"
      />
      <span className="relative z-10">{children}</span>
    </button>
  );
}

function ChromeText({ children }: { children: ReactNode }) {
  return (
    <span
      className="bg-clip-text text-transparent animate-metallic-text"
      style={{
        backgroundImage: 'linear-gradient(90deg, #4a5850 0%, #eef1ec 20%, #6b7d70 40%, #f5f7f2 60%, #3d4a41 80%, #dfe6dd 100%)',
        backgroundSize: '300% 100%',
      }}
    >
      {children}
    </span>
  );
}

export function MetallicDemo() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center gap-12 p-8">
      <div className="text-center max-w-lg">
        <h1 className="text-3xl font-semibold mb-2">
          <ChromeText>Metallic surfaces</ChromeText>
        </h1>
        <p className="text-white/40 text-sm">
          A brushed-metal gradient (built from the app's own dark-green primary, not generic
          silver) with a cursor-tracked highlight and a looping specular sheen — meant as a
          "less plastic" alternative to flat cards/buttons.
        </p>
      </div>

      <MetallicCard className="w-full max-w-md p-8">
        <h2 className="text-lg font-semibold mb-1 text-white">Move your cursor over this card</h2>
        <p className="text-sm text-white/60 mb-6">
          The highlight follows the mouse; the diagonal sheen loops on its own regardless.
        </p>
        <MetallicButton>Hover me too →</MetallicButton>
      </MetallicCard>

      <div className="flex flex-col items-center gap-3">
        <span className="text-white/30 text-xs uppercase tracking-wide">Chrome text, standalone</span>
        <div className="text-4xl font-bold">
          <ChromeText>Meridian</ChromeText>
        </div>
      </div>
    </div>
  );
}
