import React from 'react';
import { GameEvent, EventType, Team, Zone } from '../types';

interface RinkChartProps {
  events: GameEvent[];
  leftLogo?: string;
  rightLogo?: string;
  onPlot?: (x: number, y: number) => void;
  onMoveEvent?: (eventId: string, x: number, y: number) => void;
  activeEventType?: EventType;
}

const FACEOFF_DOTS = [
  { x: 100, y: 42.5 },   // Center Ice
  { x: 31, y: 20.5 },    // Left Top End
  { x: 31, y: 64.5 },    // Left Bottom End
  { x: 169, y: 20.5 },   // Right Top End
  { x: 169, y: 64.5 },   // Right Bottom End
  { x: 80, y: 20.5 },    // Left Top Neutral
  { x: 80, y: 64.5 },    // Left Bottom Neutral
  { x: 120, y: 20.5 },   // Right Top Neutral
  { x: 120, y: 64.5 },   // Right Bottom Neutral
];

const CIRCLE_DOTS = [
  { x: 100, y: 42.5 },   // Center Ice
  { x: 31, y: 20.5 },    // Left Top End
  { x: 31, y: 64.5 },    // Left Bottom End
  { x: 169, y: 20.5 },   // Right Top End
  { x: 169, y: 64.5 },   // Right Bottom End
];

const RinkChart: React.FC<RinkChartProps> = ({ 
  events, 
  leftLogo,
  rightLogo,
  onPlot,
  onMoveEvent,
  activeEventType
}) => {
  const draggingRef = React.useRef<{ id: string } | null>(null);
  const getSVGCoords = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget as SVGSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const cursor = pt.matrixTransform(ctm.inverse());
    return { x: cursor.x / 5, y: cursor.y / 5 };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const coords = getSVGCoords(e);
    if (!coords) return;
    const { x, y } = coords;

    // Check if clicking near an existing event dot — if so, start dragging it
    if (onMoveEvent) {
      const DRAG_THRESHOLD = 8;
      const hit = events.find(ev => {
        if (!ev.coordinates) return false;
        const dx = ev.coordinates.x - x;
        const dy = ev.coordinates.y - y;
        return Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD;
      });
      if (hit) {
        draggingRef.current = { id: hit.id };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Otherwise plot a new event
    if (!onPlot) return;

    let px = x;
    let py = y;

    const isFaceoff = activeEventType === EventType.FACEOFF_WIN || activeEventType === EventType.FACEOFF_LOSS;
    if (isFaceoff) {
      let closestDot = FACEOFF_DOTS[0];
      let minDistance = Infinity;
      FACEOFF_DOTS.forEach(dot => {
        const dist = Math.sqrt(Math.pow(dot.x - px, 2) + Math.pow(dot.y - py, 2));
        if (dist < minDistance) { minDistance = dist; closestDot = dot; }
      });
      px = closestDot.x; py = closestDot.y; // always snap to nearest dot
    }

    onPlot(px, py);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current || !onMoveEvent) return;
    const coords = getSVGCoords(e);
    if (!coords) return;
    // Clamp to rink bounds
    const x = Math.max(2, Math.min(198, coords.x));
    const y = Math.max(2, Math.min(83, coords.y));
    onMoveEvent(draggingRef.current.id, x, y);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    draggingRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const getEventStyle = (event: GameEvent) => {
    // Event-specific colors
    const SHOT_CYAN = '#06b6d4';
    const GOAL_GREEN = '#22c55e';
    const TURNOVER_ORANGE = '#f97316';
    const PENALTY_RED = '#ef4444';
    const HIT_GRAY = '#a855f7';
    const BLOCK_SLATE = '#94a3b8';
    const PP_FOR_GOLD = '#eab308';
    const PP_AGAINST_PINK = '#ec4899';

    switch (event.type) {
      case EventType.GOAL: 
        return { color: GOAL_GREEN, size: 9, glow: true, opacity: 1 };
      case EventType.SHOT: 
        return { color: SHOT_CYAN, size: 6, opacity: 1 };
      case EventType.BLOCK:
        return { color: BLOCK_SLATE, size: 6, opacity: 0.8 };
      case EventType.PP_SHOT_FOR:
        return { color: PP_FOR_GOLD, size: 7, glow: false, opacity: 1 };
      case EventType.PP_SHOT_AGAINST:
        return { color: PP_AGAINST_PINK, size: 7, glow: false, opacity: 1 };
      case EventType.TURNOVER: 
        return { color: TURNOVER_ORANGE, size: 6, opacity: 0.8 };
      case EventType.PENALTY: 
        return { color: PENALTY_RED, size: 8, glow: true, opacity: 1 };
      case EventType.FACEOFF_WIN: 
        return { color: '#ffffff', size: 7, opacity: 1 }; 
      case EventType.FACEOFF_LOSS: 
        return { color: 'none', size: 4, opacity: 0.4 };
      case EventType.HIT: 
        return { color: HIT_GRAY, size: 5, opacity: 0.85, shape: 'diamond' };
      default: 
        return { color: '#ffffff', size: 5, opacity: 0.8 };
    }
  };

  const BRIGHT_RED = "#ff0000";
  const BRIGHT_BLUE = "#2563eb";
  const SOLID_CREASE_BLUE = "#4182f9";
  const rinkWidth = 1000;
  const rinkHeight = 425;
  const centerLineX = 500;
  const blueLineOffset = 375;
  const goalLineOffset = 55;
  const faceoffCircleRadius = 75;
  const creaseRadius = 30;
  // Watermark logo — fixed bounding-box size so every team logo renders at
  // identical visual scale regardless of the source image's aspect ratio
  // (preserveAspectRatio="xMidYMid meet" below fits each logo uniformly
  // within this box without distortion).
  const watermarkLogoSize = 90;

  const isFaceoffToolActive = activeEventType === EventType.FACEOFF_WIN || activeEventType === EventType.FACEOFF_LOSS;

  // Center the logo horizontally in the open ice between the end-zone
  // faceoff circle's outer edge and the blue line, with margin on both
  // sides so it never touches either. Vertically it stays at net height
  // (mid-rink), matching where the logo has always sat.
  const endCircleX = 155;
  const endCircleRadius = 75;
  const leftGapStart = endCircleX + endCircleRadius; // circle's right edge = 230
  const leftGapEnd = blueLineOffset; // 375
  const leftLogoCenterX = (leftGapStart + leftGapEnd) / 2; // 302.5
  const rightLogoCenterX = rinkWidth - leftLogoCenterX; // mirror = 697.5

  const leftLogoX = leftLogoCenterX - watermarkLogoSize / 2;
  const rightLogoX = rightLogoCenterX - watermarkLogoSize / 2;
  const logoY = (rinkHeight / 2) - (watermarkLogoSize / 2); // net height, same as original

  return (
    <div className="relative aspect-[200/85] bg-transparent overflow-hidden touch-none group">
      <svg viewBox={`0 0 ${rinkWidth} ${rinkHeight}`} className="w-full h-full cursor-crosshair select-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        <defs>
          <filter id="grayscale">
            <feColorMatrix type="matrix" values="0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0 0 0 1 0"/>
          </filter>
          <filter id="glow-filter" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <rect x="0" y="0" width={rinkWidth} height={rinkHeight} fill="#f8fafc" fillOpacity="0.03" />
        
        <rect x="5" y="5" width="990" height="415" rx="140" ry="140" fill="none" stroke="#2a384e" strokeWidth="4" />

        {leftLogo && (
          <image 
            href={leftLogo} 
            x={leftLogoX} y={logoY} 
            width={watermarkLogoSize} height={watermarkLogoSize} 
            opacity="0.22" 
            preserveAspectRatio="xMidYMid meet"
          />
        )}
        {rightLogo && (
          <image 
            href={rightLogo} 
            x={rightLogoX} y={logoY} 
            width={watermarkLogoSize} height={watermarkLogoSize} 
            opacity="0.22" 
            preserveAspectRatio="xMidYMid meet"
          />
        )}
        
        <path 
          d={`M ${goalLineOffset} ${rinkHeight/2 - creaseRadius} A ${creaseRadius} ${creaseRadius} 0 0 1 ${goalLineOffset} ${rinkHeight/2 + creaseRadius}`} 
          fill={SOLID_CREASE_BLUE} 
          stroke={BRIGHT_RED} 
          strokeWidth="2" 
        />
        <path 
          d={`M ${rinkWidth - goalLineOffset} ${rinkHeight/2 - creaseRadius} A ${creaseRadius} ${creaseRadius} 0 0 0 ${rinkWidth - goalLineOffset} ${rinkHeight/2 + creaseRadius}`} 
          fill={SOLID_CREASE_BLUE} 
          stroke={BRIGHT_RED} 
          strokeWidth="2" 
        />

        <line x1={centerLineX} y1="5" x2={centerLineX} y2="420" stroke={BRIGHT_RED} strokeWidth="6" />
        <line x1={blueLineOffset} y1="5" x2={blueLineOffset} y2="420" stroke={BRIGHT_BLUE} strokeWidth="8" opacity="0.8" />
        <line x1={rinkWidth - blueLineOffset} y1="5" x2={rinkWidth - blueLineOffset} y2="420" stroke={BRIGHT_BLUE} strokeWidth="8" opacity="0.8" />
        <line x1={goalLineOffset} y1="35" x2={goalLineOffset} y2="390" stroke={BRIGHT_RED} strokeWidth="3" />
        <line x1={rinkWidth - goalLineOffset} y1="35" x2={rinkWidth - goalLineOffset} y2="390" stroke={BRIGHT_RED} strokeWidth="3" />

        {CIRCLE_DOTS.map((dot, i) => (
          <circle 
            key={`circle-${i}`} 
            cx={dot.x * 5} cy={dot.y * 5} 
            r={faceoffCircleRadius} 
            fill="none" 
            stroke={dot.x === 100 ? BRIGHT_BLUE : BRIGHT_RED} 
            strokeWidth="2" 
            opacity="0.3" 
          />
        ))}

        {FACEOFF_DOTS.map((dot, i) => (
          <g key={`dot-${i}`}>
            <circle 
              cx={dot.x * 5} cy={dot.y * 5} r="6" 
              fill={BRIGHT_RED} 
              fillOpacity={isFaceoffToolActive ? 0.8 : 0.4} 
              className="transition-opacity duration-300"
            />
          </g>
        ))}

        {events.map(e => {
          if (!e.coordinates) return null;
          const style = getEventStyle(e);
          const cx = e.coordinates.x * 5;
          const cy = e.coordinates.y * 5;
          const isDragging = draggingRef.current?.id === e.id;
          return (
            <g key={e.id} className="animate-in fade-in zoom-in duration-300" style={{ cursor: 'grab' }}>
              {/* Invisible larger hit target for easier grabbing */}
              <circle cx={cx} cy={cy} r={style.size * 2.5} fill="transparent" />
              {style.glow && (
                <>
                  <circle 
                    cx={cx} cy={cy} 
                    r={style.size * 2.2} 
                    fill={style.color} 
                    fillOpacity="0.4"
                    filter="url(#glow-filter)"
                  >
                    <animate attributeName="r" values={`${style.size * 1.5};${style.size * 3.5};${style.size * 1.5}`} dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                  <circle 
                    cx={cx} cy={cy} 
                    r={style.size * 1.5} 
                    fill={style.color} 
                    fillOpacity="0.3"
                    filter="url(#glow-filter)"
                  />
                </>
              )}
              <circle 
                cx={cx} cy={cy} 
                r={style.size} 
                fill={style.color} 
                fillOpacity={style.opacity}
                className="drop-shadow-lg"
                filter={style.glow ? "url(#glow-filter)" : undefined}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default RinkChart;
