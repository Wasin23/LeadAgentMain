# Meridian Frontend (moderntask)

Next.js App Router frontend for Meridian.

## UI / Animation Tooling

Two animation libraries are already installed and available — no new dependency
needed to use either:

- **Framer Motion** (`framer-motion`) — for React component animation: entrance/exit
  transitions, staggered lists (`staggerChildren`), scroll-triggered reveals
  (`whileInView`), shared-element transitions (`layoutId`), gesture-driven motion
  (drag, hover, tap), spring physics. Use this for anything inside the actual React
  app — dashboard, sign-in, agent pages, etc.
  - Live example: `app/signin/page.tsx` — the sign-in card's logo and card body use
    a staggered fade/slide-in entrance (`cardContainerVariants` / `cardItemVariants`,
    defined near the top of the file) as a reference pattern to copy from.

- **GSAP** (`gsap`) — for anything outside React, or for more complex timeline-based
  sequencing. Use this for `moderntask/public/landing.html` specifically — that page
  is plain static HTML/JS (not a React component), so Framer Motion does **not**
  work there; GSAP (or vanilla CSS `@keyframes`/`transition`) is the right tool for
  animating it.

**Rule of thumb:** React page/component → Framer Motion. `public/landing.html` →
GSAP or plain CSS/JS.

## Structure

- `app/` — Next.js App Router pages
- `components/` — shared React components
- `public/landing.html` — static marketing homepage (served at the domain root,
  not part of the Next.js React tree)
