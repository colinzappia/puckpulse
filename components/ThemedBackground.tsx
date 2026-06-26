import React from 'react';

/**
 * ThemedBackground
 * Reusable ice-texture + scattered X's/O's whiteboard background used across
 * all marketing/info pages (Landing, About, Contact, Advertise, Terms, Privacy).
 * NOT used on the main rink-tracking app screen, which stays clean for function.
 *
 * Usage:
 *   <ThemedBackground>
 *     ...page content...
 *   </ThemedBackground>
 */

// Deterministic pseudo-random scatter so the pattern is stable across renders
// (no Math.random in render — values are pre-computed once at module load).
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateScatter(pageHeight: number) {
  const rand = seededRandom(99);
  const circles: { x: number; y: number; r: number }[] = [];
  const xs: { x: number; y: number; s: number }[] = [];

  const nCirc = 24;
  const nX = 28;
  const bands = nCirc + nX;
  const bandH = pageHeight / bands;
  const ys: number[] = [];
  for (let i = 0; i < bands; i++) {
    ys.push(Math.round(i * bandH + rand() * bandH * 0.8));
  }
  // shuffle ys
  for (let i = ys.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ys[i], ys[j]] = [ys[j], ys[i]];
  }

  let idx = 0;
  for (let i = 0; i < nCirc; i++) {
    const side = rand() > 0.5 ? 'l' : 'r';
    const x = side === 'l' ? Math.round(20 + rand() * 460) : Math.round(1020 + rand() * 450);
    const y = ys[idx++];
    const r = Math.round(14 + rand() * 16);
    circles.push({ x, y, r });
  }
  for (let i = 0; i < nX; i++) {
    const side = rand() > 0.5 ? 'l' : 'r';
    const x = side === 'l' ? Math.round(100 + rand() * 420) : Math.round(980 + rand() * 400);
    const y = ys[idx++];
    const s = Math.round(14 + rand() * 10);
    xs.push({ x, y, s });
  }
  return { circles, xs };
}

const PAGE_H = 2400; // base unit; SVG stretches via preserveAspectRatio="none"
const { circles, xs } = generateScatter(PAGE_H);

// Build connector lines between nearby points for the "play diagram" look
const allPts = [...circles.map(c => ({ x: c.x, y: c.y })), ...xs.map(x => ({ x: x.x, y: x.y }))];
const connectors: { x1: number; y1: number; x2: number; y2: number }[] = [];
for (let i = 0; i < allPts.length - 1; i += 2) {
  const p1 = allPts[i];
  const p2 = allPts[i + 1];
  if (p1 && p2 && Math.abs(p1.y - p2.y) < 500) {
    connectors.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
  }
}

interface ThemedBackgroundProps {
  children: React.ReactNode;
  className?: string;
  /** 'full' = marketing/info pages (default). 'subtle' = dialed back for screens with dense functional UI, like the main app. */
  intensity?: 'full' | 'subtle';
}

const ThemedBackground: React.FC<ThemedBackgroundProps> = ({ children, className = '', intensity = 'full' }) => {
  const isSubtle = intensity === 'subtle';
  const blobOpacityMult = isSubtle ? 0.45 : 1;
  const xoOpacity = isSubtle ? 0.35 : 1;
  const scratchOpacity = isSubtle ? 0.28 : 0.5;

  return (
    <div className={`relative min-h-screen bg-[#070a0f] overflow-hidden ${className}`}>
      {/* Scratched ice texture layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <svg
          viewBox={`0 0 1500 ${PAGE_H}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="tch-ice-scratch">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="3" seed="7" result="noise" />
              <feColorMatrix
                in="noise"
                type="matrix"
                values="0 0 0 0 0.45  0 0 0 0 0.55  0 0 0 0 0.65  0 0 0 0.5 0"
              />
              <feComposite operator="in" in2="SourceGraphic" />
            </filter>
            <radialGradient id="tch-ice-vignette" cx="50%" cy="20%" r="90%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#0f172a" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#020308" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1500" height={PAGE_H} fill="#070a0f" />
          <rect width="1500" height={PAGE_H} filter="url(#tch-ice-scratch)" opacity={scratchOpacity} />
          <rect width="1500" height={PAGE_H} fill="url(#tch-ice-vignette)" />
        </svg>
      </div>

      {/* Glowing gradient blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            width: 820, height: 820, background: '#1d4ed8', opacity: 0.32 * blobOpacityMult, top: -300, left: -240,
            filter: 'blur(90px)', animation: 'tchFloat1 11s ease-in-out infinite',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 680, height: 680, background: '#b91c1c', opacity: 0.28 * blobOpacityMult, top: 20, right: -220,
            filter: 'blur(90px)', animation: 'tchFloat2 13s ease-in-out infinite',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 560, height: 560, background: '#ca8a04', opacity: 0.22 * blobOpacityMult, bottom: -260, left: '32%',
            filter: 'blur(90px)', animation: 'tchFloat3 12s ease-in-out infinite',
          }}
        />
      </div>

      {/* X's and O's whiteboard scatter, randomized & connected */}
      <svg
        className="fixed inset-0 z-0 pointer-events-none w-full h-full"
        viewBox={`0 0 1400 ${PAGE_H}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: xoOpacity }}
      >
        <g stroke="#60a5fa" strokeWidth="3.5" fill="none">
          {circles.map((c, i) => (
            <circle key={`c-${i}`} cx={c.x} cy={c.y} r={c.r} />
          ))}
        </g>
        <g stroke="#f87171" strokeWidth="4">
          {xs.map((x, i) => (
            <path
              key={`x-${i}`}
              d={`M${x.x - x.s} ${x.y - x.s} L${x.x + x.s} ${x.y + x.s} M${x.x + x.s} ${x.y - x.s} L${x.x - x.s} ${x.y + x.s}`}
            />
          ))}
        </g>
        <g stroke="#cbd5e1" strokeWidth="2" strokeDasharray="8,8" opacity="0.5">
          {connectors.map((c, i) => (
            <path key={`l-${i}`} d={`M${c.x1} ${c.y1} L${c.x2} ${c.y2}`} />
          ))}
        </g>
      </svg>

      <style>{`
        @keyframes tchFloat1 { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(90px,60px) scale(1.08);} }
        @keyframes tchFloat2 { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(-80px,90px) scale(1.1);} }
        @keyframes tchFloat3 { 0%,100%{transform:translate(0,0) scale(1);} 50%{transform:translate(70px,-80px) scale(1.05);} }
      `}</style>

      {/* Page content sits above all background layers */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default ThemedBackground;
