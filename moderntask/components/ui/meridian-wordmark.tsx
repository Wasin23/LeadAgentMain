interface Props {
  className?: string
  color?: string
}

export function MeridianWordmark({ className, color = "#9BAAB8" }: Props) {
  return (
    <svg
      viewBox="0 0 500 105"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g stroke={color} strokeWidth="9" strokeLinecap="square" strokeLinejoin="miter">
        {/* M */}
        <path d="M 5,95 L 5,10 L 36,58 L 67,10 L 67,95" />

        {/* E */}
        <g transform="translate(95,0)">
          <path d="M 44,10 L 5,10 L 5,95 L 44,95 M 5,52 L 38,52" />
        </g>

        {/* R */}
        <g transform="translate(161,0)">
          <path d="M 5,95 L 5,10 L 28,10 L 44,24 L 44,44 L 28,56 L 5,56 M 27,56 L 44,95" />
        </g>

        {/* I */}
        <g transform="translate(228,0)">
          <line x1="5" y1="10" x2="5" y2="95" />
        </g>

        {/* D */}
        <g transform="translate(256,0)">
          <path d="M 5,10 L 5,95 L 28,95 L 44,79 L 44,26 L 28,10 Z" />
        </g>

        {/* I */}
        <g transform="translate(323,0)">
          <line x1="5" y1="10" x2="5" y2="95" />
        </g>

        {/* A — Λ, no crossbar */}
        <g transform="translate(351,0)">
          <path d="M 5,95 L 30,10 L 55,95" />
        </g>

        {/* N */}
        <g transform="translate(429,0)">
          <path d="M 5,95 L 5,10 L 60,95 L 60,10" />
        </g>
      </g>
    </svg>
  )
}
