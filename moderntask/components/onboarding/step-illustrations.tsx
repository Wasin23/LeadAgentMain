// Inline SVG illustrations for each onboarding step.
// White + green-400 palette — designed for the dark green (#0d2b1e) right panel.

export function IllustrationCompanyScrape() {
  return (
    <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Glow base */}
      <ellipse cx="180" cy="292" rx="110" ry="10" fill="#4ade80" fillOpacity="0.07" />

      {/* Browser card */}
      <rect x="24" y="24" width="312" height="230" rx="14" fill="white" fillOpacity="0.04" stroke="white" strokeOpacity="0.12" strokeWidth="1.5" />

      {/* Title bar */}
      <rect x="24" y="24" width="312" height="42" rx="14" fill="white" fillOpacity="0.06" />
      <rect x="24" y="52" width="312" height="14" fill="white" fillOpacity="0.06" />

      {/* Traffic lights */}
      <circle cx="48"  cy="45" r="5" fill="white" fillOpacity="0.15" />
      <circle cx="62"  cy="45" r="5" fill="white" fillOpacity="0.15" />
      <circle cx="76"  cy="45" r="5" fill="#4ade80" fillOpacity="0.55" />

      {/* URL bar */}
      <rect x="94" y="34" width="196" height="22" rx="6" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
      {/* Lock dot */}
      <circle cx="106" cy="45" r="3" fill="white" fillOpacity="0.3" />
      {/* URL text simulation */}
      <rect x="114" y="40" width="80" height="6" rx="2" fill="white" fillOpacity="0.25" />
      <rect x="198" y="40" width="50" height="6" rx="2" fill="white" fillOpacity="0.1" />

      {/* ── Scan line ── */}
      <rect x="24"  y="148" width="312" height="1" fill="#4ade80" fillOpacity="0.15" />
      <rect x="24"  y="148" width="210" height="1" fill="#4ade80" fillOpacity="0.7" />
      {/* Scan glow dot */}
      <circle cx="234" cy="148" r="18" fill="#4ade80" fillOpacity="0.06" />
      <circle cx="234" cy="148" r="9"  fill="#4ade80" fillOpacity="0.15" />
      <circle cx="234" cy="148" r="4"  fill="#4ade80" fillOpacity="0.95" />

      {/* ── Rows ABOVE scan (completed / bright) ── */}
      {/* Row 1 */}
      <rect x="48" y="84"  width="52" height="7" rx="2" fill="white" fillOpacity="0.2" />
      <rect x="112" y="84" width="130" height="7" rx="2" fill="white" fillOpacity="0.65" />
      <circle cx="260" cy="87" r="4" fill="#4ade80" fillOpacity="0.8" />

      {/* Row 2 */}
      <rect x="48" y="102" width="40" height="7" rx="2" fill="white" fillOpacity="0.18" />
      <rect x="98"  y="102" width="100" height="7" rx="2" fill="white" fillOpacity="0.5" />
      <circle cx="214" cy="105" r="4" fill="#4ade80" fillOpacity="0.8" />

      {/* Row 3 */}
      <rect x="48" y="120" width="56" height="7" rx="2" fill="white" fillOpacity="0.15" />
      <rect x="114" y="120" width="80" height="7" rx="2" fill="white" fillOpacity="0.4" />
      <circle cx="208" cy="123" r="4" fill="#4ade80" fillOpacity="0.7" />

      {/* ── Row AT scan (filling in — green tint) ── */}
      <rect x="48"  y="158" width="48" height="7" rx="2" fill="white" fillOpacity="0.12" />
      <rect x="106" y="158" width="60" height="7" rx="2" fill="#4ade80" fillOpacity="0.35" />
      {/* blinking cursor */}
      <rect x="168" y="158" width="2" height="7" rx="1" fill="#4ade80" fillOpacity="0.8" />

      {/* ── Rows BELOW scan (not yet filled — faint) ── */}
      <rect x="48"  y="176" width="44" height="7" rx="2" fill="white" fillOpacity="0.08" />
      <rect x="102" y="176" width="90" height="7" rx="2" fill="white" fillOpacity="0.08" />

      <rect x="48"  y="194" width="58" height="7" rx="2" fill="white" fillOpacity="0.05" />
      <rect x="116" y="194" width="70" height="7" rx="2" fill="white" fillOpacity="0.05" />

      <rect x="48"  y="212" width="36" height="7" rx="2" fill="white" fillOpacity="0.04" />
      <rect x="94"  y="212" width="100" height="7" rx="2" fill="white" fillOpacity="0.04" />

      {/* Corner logo placeholder */}
      <rect x="280" y="80" width="44" height="44" rx="10" fill="white" fillOpacity="0.05" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      <rect x="293" y="94" width="18" height="4" rx="1.5" fill="white" fillOpacity="0.2" />
      <rect x="293" y="102" width="12" height="4" rx="1.5" fill="white" fillOpacity="0.13" />
      <rect x="293" y="110" width="15" height="4" rx="1.5" fill="white" fillOpacity="0.1" />
    </svg>
  )
}
