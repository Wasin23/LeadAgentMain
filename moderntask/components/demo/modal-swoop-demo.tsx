'use client';

import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'modal-swoop-tr' | 'modal-swoop-tl' | 'modal-swoop-up';

const VARIANTS: { id: Variant; label: string; desc: string }[] = [
  { id: 'modal-swoop-tr', label: 'Swoop — top right', desc: 'Panel swoops in from the top-right corner and settles' },
  { id: 'modal-swoop-tl', label: 'Swoop — top left', desc: 'Same swoop, mirrored from the top-left' },
  { id: 'modal-swoop-up', label: 'Swoop — up', desc: 'Straight up from below, no rotation' },
];

export function ModalSwoopDemo() {
  const [open, setOpen] = useState<Variant | null>(null);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-semibold mb-1">Modal open animation</h1>
        <p className="text-white/40 text-sm mb-8">Click a variant to preview the swoop-in. Same sample modal each time — only the entrance differs.</p>

        <div className="flex flex-col gap-3">
          {VARIANTS.map(v => (
            <button
              key={v.id}
              onClick={() => setOpen(v.id)}
              className="w-full text-left px-4 py-3 rounded-xl border border-white/10 hover:border-white/30 hover:bg-white/5 transition-colors"
            >
              <div className="text-sm font-medium">{v.label}</div>
              <div className="text-xs text-white/40 mt-0.5">{v.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div
          key={open}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-swoop-backdrop"
          onClick={() => setOpen(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={cn(
              'w-full max-w-sm rounded-2xl border border-border bg-background shadow-2xl p-6',
              `animate-${open}`,
            )}
            style={{ transformOrigin: open === 'modal-swoop-tl' ? 'top left' : open === 'modal-swoop-tr' ? 'top right' : 'bottom center' }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="w-4.5 h-4.5 text-primary" />
              </div>
              <button onClick={() => setOpen(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <h2 className="text-base font-semibold text-foreground mb-1">Sample modal</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This is a stand-in for any real modal (upgrade plan, add payment method, etc.) — only the open animation is being tested here.
            </p>
            <button
              onClick={() => setOpen(null)}
              className="w-full h-10 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
