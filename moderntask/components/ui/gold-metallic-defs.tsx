import { GOLD_METALLIC_STOPS } from '@/lib/gold-metallic';

// Renders once at the app root. SVG fills can't reference a CSS background, so any
// icon that wants the gold-metallic look points its fill/stroke at this gradient's id
// instead of a Tailwind color utility (see star-button.tsx, leads-content.tsx).
export function GoldMetallicDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <linearGradient id="gold-metallic-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          {GOLD_METALLIC_STOPS.map(s => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
    </svg>
  );
}
