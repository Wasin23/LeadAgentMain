// Shared gold-metallic gradient — reused by the upgrade-plan modal header (a CSS
// background, animated via the metallic-drift/metallic-sweep classes) and by the
// star icons (an SVG <linearGradient> referenced via fill="url(#gold-metallic-fill)",
// since SVG fills can't take a plain CSS background).
export const GOLD_METALLIC_GRADIENT =
  'linear-gradient(135deg, #6b4f18 0%, #d4af37 18%, #fff6d8 32%, #b8860b 46%, #f5deb3 60%, #6b4f18 74%, #d4af37 88%, #8a6a1f 100%)';

export const GOLD_METALLIC_STOPS = [
  { offset: '0%', color: '#6b4f18' },
  { offset: '20%', color: '#d4af37' },
  { offset: '40%', color: '#fff6d8' },
  { offset: '60%', color: '#b8860b' },
  { offset: '80%', color: '#f5deb3' },
  { offset: '100%', color: '#8a6a1f' },
];
