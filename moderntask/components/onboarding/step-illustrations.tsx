// Inline SVG illustrations for each onboarding step.
// White + green-400 palette on dark green (#0d2b1e) background.

const G = '#4ade80'

// ─── Team Prompt ─────────────────────────────────────────────────────────────
export function IllustrationTeam() {
  return (
    <svg viewBox="0 0 360 500" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Dot grid background */}
      {Array.from({ length: 12 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => (
          <circle key={`${row}-${col}`} cx={col * 46 + 20} cy={row * 44 + 18} r="1.2" fill="white" fillOpacity="0.07" />
        ))
      )}

      {/* ── Curved connection lines ── */}
      <path d="M180 90 Q230 140 290 160" stroke={G} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="5 4" fill="none" />
      <path d="M180 90 Q130 160 80 200" stroke={G} strokeOpacity="0.2"  strokeWidth="1" strokeDasharray="5 4" fill="none" />
      <path d="M290 160 Q310 240 280 310" stroke={G} strokeOpacity="0.18" strokeWidth="1" strokeDasharray="5 4" fill="none" />
      <path d="M80 200 Q60 280 100 350" stroke={G} strokeOpacity="0.18" strokeWidth="1" strokeDasharray="5 4" fill="none" />
      <path d="M290 160 Q240 280 200 340" stroke={G} strokeOpacity="0.15" strokeWidth="1" strokeDasharray="5 4" fill="none" />

      {/* Glow dots at nodes */}
      {[[180,90],[290,160],[80,200],[280,310],[200,340],[100,350]].map(([cx,cy],i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="8"  fill={G} fillOpacity="0.1" />
          <circle cx={cx} cy={cy} r="4"  fill={G} fillOpacity="0.35" />
          <circle cx={cx} cy={cy} r="2"  fill={G} fillOpacity="0.9" />
        </g>
      ))}

      {/* ── Team member cards ── */}
      {/* Card 1 — top center */}
      <rect x="96" y="30" width="168" height="52" rx="12" fill="white" fillOpacity="0.08" stroke="white" strokeOpacity="0.15" strokeWidth="1" />
      {/* People icon */}
      <circle cx="124" cy="48" r="7" fill="white" fillOpacity="0.2" />
      <circle cx="134" cy="48" r="7" fill="white" fillOpacity="0.15" />
      <circle cx="144" cy="48" r="7" fill="white" fillOpacity="0.1" />
      <rect x="160" y="40" width="80" height="7" rx="2" fill="white" fillOpacity="0.4" />
      <rect x="160" y="52" width="56" height="5" rx="2" fill="white" fillOpacity="0.2" />

      {/* Card 2 — right */}
      <rect x="208" y="130" width="144" height="52" rx="12" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
      <circle cx="232" cy="148" r="7" fill="white" fillOpacity="0.18" />
      <circle cx="242" cy="148" r="7" fill="white" fillOpacity="0.13" />
      <circle cx="252" cy="148" r="7" fill="white" fillOpacity="0.08" />
      <rect x="268" y="140" width="64" height="7" rx="2" fill="white" fillOpacity="0.38" />
      <rect x="268" y="152" width="44" height="5" rx="2" fill="white" fillOpacity="0.18" />

      {/* Card 3 — left */}
      <rect x="10" y="170" width="144" height="52" rx="12" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
      <circle cx="34" cy="188" r="7" fill="white" fillOpacity="0.18" />
      <circle cx="44" cy="188" r="7" fill="white" fillOpacity="0.13" />
      <circle cx="54" cy="188" r="7" fill="white" fillOpacity="0.08" />
      <rect x="70" y="180" width="68" height="7" rx="2" fill="white" fillOpacity="0.38" />
      <rect x="70" y="192" width="48" height="5" rx="2" fill="white" fillOpacity="0.18" />

      {/* Card 4 — bottom right */}
      <rect x="186" y="278" width="144" height="52" rx="12" fill="white" fillOpacity="0.06" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      <circle cx="210" cy="296" r="7" fill="white" fillOpacity="0.15" />
      <circle cx="220" cy="296" r="7" fill="white" fillOpacity="0.1" />
      <circle cx="230" cy="296" r="7" fill="white" fillOpacity="0.07" />
      <rect x="246" y="288" width="64" height="7" rx="2" fill="white" fillOpacity="0.32" />
      <rect x="246" y="300" width="44" height="5" rx="2" fill="white" fillOpacity="0.15" />

      {/* Card 5 — bottom left */}
      <rect x="20" y="318" width="148" height="52" rx="12" fill="white" fillOpacity="0.06" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      <circle cx="44" cy="336" r="7" fill="white" fillOpacity="0.15" />
      <circle cx="54" cy="336" r="7" fill="white" fillOpacity="0.1" />
      <circle cx="64" cy="336" r="7" fill="white" fillOpacity="0.07" />
      <rect x="80" y="328" width="68" height="7" rx="2" fill="white" fillOpacity="0.3" />
      <rect x="80" y="340" width="48" height="5" rx="2" fill="white" fillOpacity="0.14" />

      {/* ── Stat widgets ── */}
      {/* 68% Active teams */}
      <rect x="10" y="400" width="100" height="88" rx="12" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
      {/* Bar chart */}
      <rect x="22" y="436" width="8"  height="28" rx="2" fill={G} fillOpacity="0.25" />
      <rect x="34" y="428" width="8"  height="36" rx="2" fill={G} fillOpacity="0.45" />
      <rect x="46" y="418" width="8"  height="46" rx="2" fill={G} fillOpacity="0.7"  />
      <rect x="58" y="424" width="8"  height="40" rx="2" fill={G} fillOpacity="0.55" />
      <rect x="22" y="470" width="44" height="5"  rx="2" fill="white" fillOpacity="0.3" />
      <rect x="22" y="479" width="60" height="4"  rx="2" fill="white" fillOpacity="0.15" />
      {/* 68% label */}
      <rect x="22" y="408" width="30" height="6" rx="2" fill={G} fillOpacity="0.55" />

      {/* +18 New members */}
      <rect x="130" y="400" width="100" height="88" rx="12" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
      <circle cx="155" cy="426" r="8" fill="white" fillOpacity="0.12" />
      <circle cx="166" cy="426" r="8" fill="white" fillOpacity="0.09" />
      {/* Trend line */}
      <polyline points="142,452 154,444 166,448 178,438 190,432 202,426" stroke={G} strokeOpacity="0.6" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <rect x="142" y="460" width="36" height="6" rx="2" fill={G} fillOpacity="0.5" />
      <rect x="142" y="470" width="60" height="4" rx="2" fill="white" fillOpacity="0.2" />
      <rect x="142" y="478" width="48" height="4" rx="2" fill="white" fillOpacity="0.12" />

      {/* 12 Projects */}
      <rect x="250" y="400" width="100" height="88" rx="12" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
      {/* Pie chart approximation */}
      <circle cx="300" cy="430" r="20" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="6" />
      <circle cx="300" cy="430" r="20" fill="none" stroke={G} strokeOpacity="0.65" strokeWidth="6"
        strokeDasharray="75 125" strokeDashoffset="31" />
      <rect x="262" y="456" width="20" height="6" rx="2" fill={G} fillOpacity="0.6" />
      <rect x="262" y="466" width="60" height="5" rx="2" fill="white" fillOpacity="0.25" />
      <rect x="262" y="475" width="40" height="4" rx="2" fill="white" fillOpacity="0.12" />
    </svg>
  )
}

// ─── Step 1: Company Scrape ───────────────────────────────────────────────────
export function IllustrationCompanyScrape() {
  return (
    <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="180" cy="292" rx="110" ry="10" fill={G} fillOpacity="0.07" />
      <rect x="24" y="24" width="312" height="230" rx="14" fill="white" fillOpacity="0.04" stroke="white" strokeOpacity="0.12" strokeWidth="1.5" />
      <rect x="24" y="24" width="312" height="42" rx="14" fill="white" fillOpacity="0.06" />
      <rect x="24" y="52" width="312" height="14" fill="white" fillOpacity="0.06" />
      <circle cx="48"  cy="45" r="5" fill="white" fillOpacity="0.15" />
      <circle cx="62"  cy="45" r="5" fill="white" fillOpacity="0.15" />
      <circle cx="76"  cy="45" r="5" fill={G} fillOpacity="0.55" />
      <rect x="94" y="34" width="196" height="22" rx="6" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
      <circle cx="106" cy="45" r="3" fill="white" fillOpacity="0.3" />
      <rect x="114" y="40" width="80" height="6" rx="2" fill="white" fillOpacity="0.25" />
      <rect x="198" y="40" width="50" height="6" rx="2" fill="white" fillOpacity="0.1" />
      {/* Scan line */}
      <rect x="24"  y="148" width="312" height="1" fill={G} fillOpacity="0.15" />
      <rect x="24"  y="148" width="210" height="1" fill={G} fillOpacity="0.7" />
      <circle cx="234" cy="148" r="18" fill={G} fillOpacity="0.06" />
      <circle cx="234" cy="148" r="9"  fill={G} fillOpacity="0.15" />
      <circle cx="234" cy="148" r="4"  fill={G} fillOpacity="0.95" />
      {/* Rows above scan — completed */}
      <rect x="48" y="84"  width="52" height="7" rx="2" fill="white" fillOpacity="0.2" />
      <rect x="112" y="84" width="130" height="7" rx="2" fill="white" fillOpacity="0.65" />
      <circle cx="260" cy="87" r="4" fill={G} fillOpacity="0.8" />
      <rect x="48" y="102" width="40" height="7" rx="2" fill="white" fillOpacity="0.18" />
      <rect x="98"  y="102" width="100" height="7" rx="2" fill="white" fillOpacity="0.5" />
      <circle cx="214" cy="105" r="4" fill={G} fillOpacity="0.8" />
      <rect x="48" y="120" width="56" height="7" rx="2" fill="white" fillOpacity="0.15" />
      <rect x="114" y="120" width="80" height="7" rx="2" fill="white" fillOpacity="0.4" />
      <circle cx="208" cy="123" r="4" fill={G} fillOpacity="0.7" />
      {/* Row at scan — filling in */}
      <rect x="48"  y="158" width="48" height="7" rx="2" fill="white" fillOpacity="0.12" />
      <rect x="106" y="158" width="60" height="7" rx="2" fill={G} fillOpacity="0.35" />
      <rect x="168" y="158" width="2"  height="7" rx="1" fill={G} fillOpacity="0.8" />
      {/* Rows below scan — unfilled */}
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

// ─── Step 2: Targeting ────────────────────────────────────────────────────────
export function IllustrationTargeting() {
  const highlighted = new Set([1, 5, 7, 10])
  const cols = 4
  const cardW = 72
  const cardH = 52
  const gapX = 12
  const gapY = 10
  const startX = (360 - (cols * cardW + (cols - 1) * gapX)) / 2
  const startY = 68

  return (
    <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="180" cy="292" rx="110" ry="10" fill={G} fillOpacity="0.07" />
      {/* Filter chips */}
      <rect x="22"  y="18" width="88" height="24" rx="12" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.15" strokeWidth="1" />
      <rect x="34"  y="27" width="44" height="6" rx="2" fill="white" fillOpacity="0.35" />
      <rect x="120" y="18" width="88" height="24" rx="12" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.15" strokeWidth="1" />
      <rect x="132" y="27" width="44" height="6" rx="2" fill="white" fillOpacity="0.35" />
      <rect x="218" y="18" width="120" height="24" rx="12" fill={G} fillOpacity="0.1" stroke={G} strokeOpacity="0.3" strokeWidth="1" />
      <rect x="230" y="27" width="56" height="6" rx="2" fill={G} fillOpacity="0.5" />
      <circle cx="294" cy="30" r="4" fill={G} fillOpacity="0.7" />

      {/* Person cards grid */}
      {Array.from({ length: 12 }, (_, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = startX + col * (cardW + gapX)
        const y = startY + row * (cardH + gapY)
        const hi = highlighted.has(i)
        return (
          <g key={i}>
            <rect x={x} y={y} width={cardW} height={cardH} rx="8"
              fill={hi ? G : 'white'} fillOpacity={hi ? 0.07 : 0.04}
              stroke={hi ? G : 'white'} strokeOpacity={hi ? 0.45 : 0.1} strokeWidth="1" />
            {/* Avatar */}
            <circle cx={x + 16} cy={y + 18} r="8" fill="white" fillOpacity={hi ? 0.35 : 0.12} />
            <rect x={x + 8} y={y + 30} width="16" height="10" rx="4" fill="white" fillOpacity={hi ? 0.2 : 0.07} />
            {/* Lines */}
            <rect x={x + 30} y={y + 13} width={hi ? 30 : 28} height="5" rx="2" fill="white" fillOpacity={hi ? 0.55 : 0.2} />
            <rect x={x + 30} y={y + 22} width={hi ? 22 : 18} height="4" rx="2" fill="white" fillOpacity={hi ? 0.3 : 0.1} />
            {/* Bottom accent */}
            <rect x={x + 8} y={y + 43} width={cardW - 16} height="3" rx="1.5"
              fill={hi ? G : 'white'} fillOpacity={hi ? 0.35 : 0.07} />
            {/* Green dot */}
            {hi && <circle cx={x + cardW - 10} cy={y + 10} r="4" fill={G} fillOpacity="0.9" />}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Step 3: Agent ────────────────────────────────────────────────────────────
export function IllustrationAgent() {
  return (
    <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Outer glow rings */}
      <circle cx="180" cy="138" r="90" fill={G} fillOpacity="0.04" />
      <circle cx="180" cy="138" r="68" fill={G} fillOpacity="0.05" />
      <circle cx="180" cy="138" r="46" stroke="white" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="4 4" />
      {/* Avatar circle */}
      <circle cx="180" cy="138" r="38" fill="white" fillOpacity="0.08" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
      {/* Person silhouette */}
      <circle cx="180" cy="126" r="12" fill="white" fillOpacity="0.5" />
      <path d="M155 162 Q155 148 180 148 Q205 148 205 162" fill="white" fillOpacity="0.35" />
      {/* AI spark top-right */}
      <circle cx="218" cy="100" r="14" fill={G} fillOpacity="0.12" stroke={G} strokeOpacity="0.3" strokeWidth="1" />
      <line x1="218" y1="93" x2="218" y2="107" stroke={G} strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="211" y1="100" x2="225" y2="100" stroke={G} strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="213" y1="95" x2="223" y2="105" stroke={G} strokeOpacity="0.4" strokeWidth="1" strokeLinecap="round" />
      <line x1="223" y1="95" x2="213" y2="105" stroke={G} strokeOpacity="0.4" strokeWidth="1" strokeLinecap="round" />
      {/* Trait pills */}
      <rect x="22"  y="88"  width="78" height="22" rx="11" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.14" strokeWidth="1" />
      <rect x="32"  y="97"  width="44" height="5"  rx="2"  fill="white" fillOpacity="0.4" />
      <rect x="22"  y="120" width="68" height="22" rx="11" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.14" strokeWidth="1" />
      <rect x="32"  y="129" width="36" height="5"  rx="2"  fill="white" fillOpacity="0.35" />
      <rect x="22"  y="152" width="82" height="22" rx="11" fill={G} fillOpacity="0.1" stroke={G} strokeOpacity="0.28" strokeWidth="1" />
      <rect x="32"  y="161" width="48" height="5"  rx="2"  fill={G} fillOpacity="0.55" />
      <rect x="260" y="88"  width="78" height="22" rx="11" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.14" strokeWidth="1" />
      <rect x="270" y="97"  width="40" height="5"  rx="2"  fill="white" fillOpacity="0.4" />
      <rect x="264" y="120" width="74" height="22" rx="11" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.14" strokeWidth="1" />
      <rect x="274" y="129" width="44" height="5"  rx="2"  fill="white" fillOpacity="0.35" />
      {/* Name bar */}
      <rect x="120" y="196" width="120" height="32" rx="10" fill="white" fillOpacity="0.06" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
      <rect x="144" y="207" width="72" height="7"  rx="3"  fill="white" fillOpacity="0.4" />
      {/* Bottom glow */}
      <ellipse cx="180" cy="292" rx="90" ry="9" fill={G} fillOpacity="0.07" />
    </svg>
  )
}

// ─── Step 4: Connect Email ────────────────────────────────────────────────────
export function IllustrationEmailConnect() {
  return (
    <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="180" cy="292" rx="110" ry="10" fill={G} fillOpacity="0.07" />
      {/* Center inbox card */}
      <rect x="110" y="100" width="140" height="100" rx="14" fill="white" fillOpacity="0.06" stroke="white" strokeOpacity="0.15" strokeWidth="1.5" />
      {/* Envelope flap */}
      <path d="M110 114 L180 152 L250 114" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="110" y1="114" x2="110" y2="200" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      <line x1="250" y1="114" x2="250" y2="200" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      {/* Green glow behind center */}
      <circle cx="180" cy="150" r="40" fill={G} fillOpacity="0.05" />
      {/* Connection nodes */}
      {/* Gmail — top left, connected */}
      <line x1="128" y1="128" x2="72" y2="80" stroke={G} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="4 3" />
      <rect x="44" y="56" width="54" height="48" rx="10" fill="white" fillOpacity="0.07" stroke={G} strokeOpacity="0.4" strokeWidth="1" />
      <circle cx="71" cy="80" r="14" fill="#ef4444" fillOpacity="0.15" />
      <rect x="62" y="75" width="18" height="5" rx="2" fill="white" fillOpacity="0.5" />
      <rect x="64" y="83" width="14" height="4" rx="2" fill="white" fillOpacity="0.3" />
      <circle cx="86" cy="60" r="5" fill={G} fillOpacity="0.9" />

      {/* Outlook — top right */}
      <line x1="232" y1="128" x2="286" y2="80" stroke="white" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="4 3" />
      <rect x="262" y="56" width="54" height="48" rx="10" fill="white" fillOpacity="0.05" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      <circle cx="289" cy="80" r="14" fill="white" fillOpacity="0.08" />
      <rect x="280" y="75" width="18" height="5" rx="2" fill="white" fillOpacity="0.35" />
      <rect x="282" y="83" width="14" height="4" rx="2" fill="white" fillOpacity="0.2" />

      {/* Mailgun — bottom left */}
      <line x1="128" y1="172" x2="72" y2="218" stroke="white" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="4 3" />
      <rect x="44" y="196" width="54" height="48" rx="10" fill="white" fillOpacity="0.05" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      <circle cx="71" cy="220" r="14" fill="white" fillOpacity="0.07" />
      <rect x="62" y="215" width="18" height="5" rx="2" fill="white" fillOpacity="0.3" />
      <rect x="64" y="223" width="14" height="4" rx="2" fill="white" fillOpacity="0.18" />

      {/* LinkedIn — bottom right */}
      <line x1="232" y1="172" x2="286" y2="218" stroke="white" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="4 3" />
      <rect x="262" y="196" width="54" height="48" rx="10" fill="white" fillOpacity="0.05" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      <circle cx="289" cy="220" r="14" fill="white" fillOpacity="0.07" />
      <rect x="280" y="215" width="18" height="5" rx="2" fill="white" fillOpacity="0.25" />
      <rect x="282" y="223" width="10" height="4" rx="2" fill="white" fillOpacity="0.15" />

      {/* "Connected" label under Gmail */}
      <rect x="44" y="110" width="54" height="14" rx="7" fill={G} fillOpacity="0.18" stroke={G} strokeOpacity="0.35" strokeWidth="1" />
      <rect x="56" y="115" width="30" height="4" rx="2" fill={G} fillOpacity="0.6" />
    </svg>
  )
}

// ─── Step 5: Outreach Settings ────────────────────────────────────────────────
export function IllustrationOutreach() {
  return (
    <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="180" cy="292" rx="110" ry="10" fill={G} fillOpacity="0.07" />
      {/* Email compose card */}
      <rect x="28" y="28" width="304" height="228" rx="14" fill="white" fillOpacity="0.04" stroke="white" strokeOpacity="0.12" strokeWidth="1.5" />
      {/* Header */}
      <rect x="28" y="28" width="304" height="40" rx="14" fill="white" fillOpacity="0.06" />
      <rect x="28" y="54" width="304" height="14" fill="white" fillOpacity="0.06" />
      <rect x="48" y="39" width="60" height="6" rx="2" fill="white" fillOpacity="0.3" />
      <rect x="48" y="49" width="90" height="5" rx="2" fill="white" fillOpacity="0.18" />
      {/* Send button */}
      <rect x="258" y="36" width="56" height="22" rx="8" fill={G} fillOpacity="0.2" stroke={G} strokeOpacity="0.4" strokeWidth="1" />
      <rect x="270" y="44" width="32" height="5" rx="2" fill={G} fillOpacity="0.7" />
      {/* Subject line */}
      <rect x="44" y="82" width="48" height="5" rx="2" fill="white" fillOpacity="0.2" />
      <rect x="44" y="94" width="80" height="8" rx="2" fill="white" fillOpacity="0.35" />
      {/* Highlighted merge tag */}
      <rect x="128" y="94" width="66" height="8" rx="4" fill={G} fillOpacity="0.2" stroke={G} strokeOpacity="0.4" strokeWidth="1" />
      <rect x="134" y="97" width="54" height="4" rx="2" fill={G} fillOpacity="0.6" />
      {/* Divider */}
      <line x1="44" y1="116" x2="316" y2="116" stroke="white" strokeOpacity="0.08" strokeWidth="1" />
      {/* Body rows */}
      <rect x="44" y="128" width="260" height="6" rx="2" fill="white" fillOpacity="0.25" />
      {/* Highlighted: {{company}} */}
      <rect x="44" y="142" width="72" height="6" rx="2" fill="white" fillOpacity="0.2" />
      <rect x="122" y="140" width="72" height="10" rx="5" fill={G} fillOpacity="0.18" stroke={G} strokeOpacity="0.35" strokeWidth="1" />
      <rect x="128" y="143" width="60" height="4" rx="2" fill={G} fillOpacity="0.55" />
      <rect x="200" y="142" width="80" height="6" rx="2" fill="white" fillOpacity="0.18" />
      <rect x="44" y="156" width="220" height="6" rx="2" fill="white" fillOpacity="0.2" />
      <rect x="44" y="170" width="180" height="6" rx="2" fill="white" fillOpacity="0.15" />
      {/* Highlighted: {{recentNews}} */}
      <rect x="44" y="184" width="50" height="6" rx="2" fill="white" fillOpacity="0.15" />
      <rect x="100" y="182" width="90" height="10" rx="5" fill={G} fillOpacity="0.15" stroke={G} strokeOpacity="0.3" strokeWidth="1" />
      <rect x="106" y="185" width="78" height="4" rx="2" fill={G} fillOpacity="0.5" />
      <rect x="196" y="184" width="100" height="6" rx="2" fill="white" fillOpacity="0.12" />
      <rect x="44" y="198" width="140" height="6" rx="2" fill="white" fillOpacity="0.1" />
      {/* Signature */}
      <line x1="44" y1="218" x2="316" y2="218" stroke="white" strokeOpacity="0.07" strokeWidth="1" />
      <rect x="44" y="226" width="70" height="5" rx="2" fill="white" fillOpacity="0.2" />
      <rect x="44" y="235" width="50" height="4" rx="2" fill="white" fillOpacity="0.12" />
      {/* AI cursor */}
      <circle cx="310" cy="150" r="10" fill={G} fillOpacity="0.15" />
      <rect x="306" y="145" width="2" height="10" rx="1" fill={G} fillOpacity="0.8" />
      <rect x="304" y="150" width="12" height="1.5" rx="0.75" fill={G} fillOpacity="0.5" />
    </svg>
  )
}

// ─── Step 6: Plan ─────────────────────────────────────────────────────────────
export function IllustrationPlan() {
  return (
    <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="180" cy="292" rx="110" ry="10" fill={G} fillOpacity="0.07" />
      {/* Left card — Basic */}
      <rect x="20" y="72" width="90" height="144" rx="12" fill="white" fillOpacity="0.04" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      <rect x="34" y="88"  width="62" height="7" rx="2" fill="white" fillOpacity="0.3" />
      <rect x="34" y="104" width="40" height="18" rx="4" fill="white" fillOpacity="0.2" />
      <rect x="34" y="130" width="62" height="4" rx="2" fill="white" fillOpacity="0.12" />
      <rect x="34" y="142" width="50" height="4" rx="2" fill="white" fillOpacity="0.1" />
      <rect x="34" y="154" width="56" height="4" rx="2" fill="white" fillOpacity="0.08" />
      <rect x="34" y="166" width="44" height="4" rx="2" fill="white" fillOpacity="0.07" />
      <rect x="34" y="192" width="62" height="18" rx="8" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.1" strokeWidth="1" />

      {/* Center card — Pro (highlighted, elevated) */}
      <rect x="132" y="44" width="96" height="196" rx="14" fill="white" fillOpacity="0.07" stroke={G} strokeOpacity="0.5" strokeWidth="1.5" />
      {/* Popular badge */}
      <rect x="151" y="34" width="58" height="20" rx="10" fill={G} fillOpacity="0.25" stroke={G} strokeOpacity="0.5" strokeWidth="1" />
      <rect x="162" y="41" width="36" height="5" rx="2" fill={G} fillOpacity="0.75" />
      <rect x="148" y="62" width="64" height="8" rx="2" fill="white" fillOpacity="0.45" />
      <rect x="148" y="78" width="44" height="22" rx="5" fill={G} fillOpacity="0.2" />
      <rect x="153" y="83" width="34" height="12" rx="3" fill={G} fillOpacity="0.5" />
      <rect x="148" y="110" width="64" height="4" rx="2" fill={G} fillOpacity="0.3" />
      <rect x="148" y="122" width="52" height="4" rx="2" fill="white" fillOpacity="0.2" />
      <rect x="148" y="134" width="58" height="4" rx="2" fill="white" fillOpacity="0.18" />
      <rect x="148" y="146" width="48" height="4" rx="2" fill="white" fillOpacity="0.15" />
      <rect x="148" y="158" width="54" height="4" rx="2" fill="white" fillOpacity="0.12" />
      <circle cx="148" cy="112" r="3" fill={G} fillOpacity="0.7" />
      <circle cx="148" cy="124" r="3" fill={G} fillOpacity="0.55" />
      <circle cx="148" cy="136" r="3" fill={G} fillOpacity="0.4" />
      <circle cx="148" cy="148" r="3" fill="white" fillOpacity="0.2" />
      <rect x="148" y="208" width="64" height="22" rx="9" fill={G} fillOpacity="0.25" stroke={G} strokeOpacity="0.45" strokeWidth="1" />
      <rect x="163" y="217" width="34" height="5" rx="2" fill={G} fillOpacity="0.8" />

      {/* Right card — Enterprise */}
      <rect x="250" y="72" width="90" height="144" rx="12" fill="white" fillOpacity="0.04" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      <rect x="264" y="88"  width="62" height="7" rx="2" fill="white" fillOpacity="0.3" />
      <rect x="264" y="104" width="40" height="18" rx="4" fill="white" fillOpacity="0.2" />
      <rect x="264" y="130" width="62" height="4" rx="2" fill="white" fillOpacity="0.12" />
      <rect x="264" y="142" width="50" height="4" rx="2" fill="white" fillOpacity="0.1" />
      <rect x="264" y="154" width="56" height="4" rx="2" fill="white" fillOpacity="0.08" />
      <rect x="264" y="166" width="44" height="4" rx="2" fill="white" fillOpacity="0.07" />
      <rect x="264" y="178" width="40" height="4" rx="2" fill="white" fillOpacity="0.06" />
      <rect x="264" y="192" width="62" height="18" rx="8" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
    </svg>
  )
}

// ─── Step 7: Speed & Alerts ───────────────────────────────────────────────────
export function IllustrationSpeed() {
  return (
    <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="180" cy="292" rx="110" ry="10" fill={G} fillOpacity="0.07" />
      {/* Speed card */}
      <rect x="28" y="24" width="304" height="120" rx="14" fill="white" fillOpacity="0.04" stroke="white" strokeOpacity="0.12" strokeWidth="1.5" />
      <rect x="48" y="42" width="80" height="7" rx="2" fill="white" fillOpacity="0.35" />
      <rect x="48" y="54" width="140" height="5" rx="2" fill="white" fillOpacity="0.15" />
      {/* Slider track */}
      <rect x="48" y="88" width="264" height="6" rx="3" fill="white" fillOpacity="0.1" />
      {/* Filled portion */}
      <rect x="48" y="88" width="186" height="6" rx="3" fill={G} fillOpacity="0.5" />
      {/* Slider thumb */}
      <circle cx="234" cy="91" r="10" fill="white" fillOpacity="0.15" stroke={G} strokeOpacity="0.6" strokeWidth="1.5" />
      <circle cx="234" cy="91" r="5"  fill={G} fillOpacity="0.9" />
      {/* Speed ticks */}
      {[48, 96, 144, 192, 240, 288, 312].map((x, i) => (
        <rect key={i} x={x} y="100" width="2" height="6" rx="1" fill="white" fillOpacity={x <= 234 ? 0.3 : 0.1} />
      ))}
      {/* Speed label */}
      <rect x="248" y="78" width="44" height="20" rx="8" fill={G} fillOpacity="0.15" stroke={G} strokeOpacity="0.3" strokeWidth="1" />
      <rect x="257" y="85" width="26" height="5" rx="2" fill={G} fillOpacity="0.65" />
      {/* Lightning bolt */}
      <path d="M44 52 L38 64 L44 64 L38 76" stroke={G} strokeOpacity="0.7" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Notification cards */}
      <rect x="28" y="160" width="304" height="52" rx="12" fill="white" fillOpacity="0.04" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      <circle cx="56" cy="186" r="12" fill="white" fillOpacity="0.08" />
      <rect x="48" y="182" width="16" height="2" rx="1" fill="white" fillOpacity="0.4" />
      <rect x="50" y="186" width="12" height="2" rx="1" fill="white" fillOpacity="0.3" />
      <rect x="48" y="190" width="16" height="2" rx="1" fill="white" fillOpacity="0.2" />
      <rect x="78" y="180" width="100" height="6" rx="2" fill="white" fillOpacity="0.35" />
      <rect x="78" y="190" width="70" height="5"  rx="2" fill="white" fillOpacity="0.18" />
      {/* Toggle on */}
      <rect x="282" y="178" width="38" height="20" rx="10" fill={G} fillOpacity="0.25" stroke={G} strokeOpacity="0.4" strokeWidth="1" />
      <circle cx="310" cy="188" r="7" fill={G} fillOpacity="0.85" />

      <rect x="28" y="224" width="304" height="52" rx="12" fill="white" fillOpacity="0.04" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
      <circle cx="56" cy="250" r="12" fill="white" fillOpacity="0.07" />
      <rect x="50" y="244" width="12" height="12" rx="3" fill="white" fillOpacity="0.2" />
      <rect x="78" y="244" width="80" height="6" rx="2" fill="white" fillOpacity="0.3" />
      <rect x="78" y="254" width="55" height="5" rx="2" fill="white" fillOpacity="0.15" />
      {/* Toggle off */}
      <rect x="282" y="242" width="38" height="20" rx="10" fill="white" fillOpacity="0.06" stroke="white" strokeOpacity="0.15" strokeWidth="1" />
      <circle cx="292" cy="252" r="7" fill="white" fillOpacity="0.3" />
    </svg>
  )
}

// ─── Step 8: CRM ─────────────────────────────────────────────────────────────
export function IllustrationCRM() {
  return (
    <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="180" cy="292" rx="110" ry="10" fill={G} fillOpacity="0.07" />
      {/* Lead cards — left column */}
      {[40, 110, 180].map((y, i) => (
        <g key={i}>
          <rect x="24" y={y} width="118" height="56" rx="10" fill="white" fillOpacity={0.06 - i * 0.01} stroke="white" strokeOpacity={0.14 - i * 0.02} strokeWidth="1" />
          <circle cx="48" cy={y + 20} r="10" fill="white" fillOpacity={0.2 - i * 0.04} />
          <rect x="64" y={y + 12} width="60" height="6" rx="2" fill="white" fillOpacity={0.4 - i * 0.06} />
          <rect x="64" y={y + 22} width="44" height="5" rx="2" fill="white" fillOpacity={0.22 - i * 0.04} />
          <rect x="30" y={y + 40} width="100" height="4" rx="2" fill="white" fillOpacity={0.1 - i * 0.02} />
        </g>
      ))}

      {/* Arrows pointing right */}
      {[60, 136, 210].map((y, i) => {
        const op = i === 0 ? 0.8 : 0.25 - i * 0.05
        const color = i === 0 ? G : 'white'
        return (
          <g key={i}>
            <line x1="148" y1={y} x2="196" y2={y} stroke={color} strokeOpacity={op} strokeWidth={i === 0 ? 1.5 : 1} strokeDasharray={i === 0 ? '0' : '4 3'} />
            <path d={`M192 ${y - 5} L200 ${y} L192 ${y + 5}`} fill="none" stroke={color} strokeOpacity={op} strokeWidth={i === 0 ? 1.5 : 1} strokeLinejoin="round" />
          </g>
        )
      })}

      {/* CRM database block — right */}
      <rect x="204" y="36" width="132" height="192" rx="14" fill="white" fillOpacity="0.05" stroke={G} strokeOpacity="0.3" strokeWidth="1.5" />
      {/* DB header */}
      <rect x="204" y="36" width="132" height="40" rx="14" fill={G} fillOpacity="0.08" />
      <rect x="204" y="62" width="132" height="14" fill={G} fillOpacity="0.06" />
      <rect x="220" y="47" width="60" height="7" rx="2" fill="white" fillOpacity="0.35" />
      <circle cx="320" cy="51" r="5" fill={G} fillOpacity="0.7" />
      {/* DB rows */}
      {[96, 116, 136, 156, 176, 196, 216].map((y, i) => (
        <g key={i}>
          <circle cx="224" cy={y + 4} r="4" fill={G} fillOpacity={0.6 - i * 0.07} />
          <rect x="236" y={y} width="80" height="5" rx="2" fill="white" fillOpacity={0.35 - i * 0.04} />
          <rect x="236" y={y + 8} width="56" height="4" rx="2" fill="white" fillOpacity={0.18 - i * 0.02} />
        </g>
      ))}
      {/* Synced badge */}
      <rect x="210" y="196" width="120" height="24" rx="10" fill={G} fillOpacity="0.15" stroke={G} strokeOpacity="0.35" strokeWidth="1" />
      <rect x="232" y="205" width="76" height="5" rx="2" fill={G} fillOpacity="0.65" />
    </svg>
  )
}

// ─── Step 9: Review & Launch ──────────────────────────────────────────────────
export function IllustrationReview() {
  const nodes = [
    { angle: -90, label: 'Company' },
    { angle: -30, label: 'Targeting' },
    { angle:  30, label: 'Agent' },
    { angle:  90, label: 'Email' },
    { angle: 150, label: 'Plan' },
    { angle: 210, label: 'CRM' },
  ]
  const cx = 180, cy = 138, orbitR = 96

  return (
    <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Outer glow */}
      <circle cx={cx} cy={cy} r="120" fill={G} fillOpacity="0.03" />
      <circle cx={cx} cy={cy} r="96"  stroke="white" strokeOpacity="0.06" strokeWidth="1" strokeDasharray="5 4" />
      {/* Inner glow rings */}
      <circle cx={cx} cy={cy} r="50" fill={G} fillOpacity="0.07" />
      <circle cx={cx} cy={cy} r="34" fill={G} fillOpacity="0.1"  />
      {/* Center orb */}
      <circle cx={cx} cy={cy} r="28" fill="white" fillOpacity="0.08" stroke={G} strokeOpacity="0.5" strokeWidth="1.5" />
      {/* Agent silhouette */}
      <circle cx={cx} cy={cy - 8} r="9" fill="white" fillOpacity="0.55" />
      <path d={`M${cx - 16} ${cy + 18} Q${cx - 16} ${cy + 6} ${cx} ${cy + 6} Q${cx + 16} ${cy + 6} ${cx + 16} ${cy + 18}`} fill="white" fillOpacity="0.4" />

      {/* Orbit nodes */}
      {nodes.map(({ angle }, i) => {
        const rad = (angle * Math.PI) / 180
        const nx = cx + orbitR * Math.cos(rad)
        const ny = cy + orbitR * Math.sin(rad)
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={G} strokeOpacity="0.12" strokeWidth="1" />
            <circle cx={nx} cy={ny} r="16" fill={G} fillOpacity="0.1" stroke={G} strokeOpacity="0.4" strokeWidth="1" />
            {/* Checkmark */}
            <path d={`M${nx - 5} ${ny} L${nx - 1} ${ny + 4} L${nx + 5} ${ny - 4}`}
              stroke={G} strokeOpacity="0.9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        )
      })}

      {/* Launch button below */}
      <rect x="120" y="208" width="120" height="36" rx="12" fill={G} fillOpacity="0.18" stroke={G} strokeOpacity="0.45" strokeWidth="1.5" />
      <rect x="145" y="222" width="70" height="7" rx="3" fill={G} fillOpacity="0.75" />

      {/* Sparkles */}
      <circle cx="52"  cy="52"  r="3" fill={G} fillOpacity="0.5" />
      <circle cx="308" cy="44"  r="2" fill={G} fillOpacity="0.4" />
      <circle cx="318" cy="220" r="3" fill={G} fillOpacity="0.35" />
      <circle cx="38"  cy="230" r="2" fill={G} fillOpacity="0.3" />
      <ellipse cx={cx} cy="290" rx="80" ry="8" fill={G} fillOpacity="0.1" />
    </svg>
  )
}
