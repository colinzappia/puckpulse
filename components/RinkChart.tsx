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

// Radius (px, in the *5-scaled SVG space) of the clickable zone around each
// faceoff dot. Main dots use the same radius as their drawn faceoff circle.
// Neutral-zone dots have no drawn circle in real rinks, so they get a
// smaller dedicated hit zone — sized so it can never reach into the
// centre-ice circle (closest approach is ~148px, circle radius is 75px,
// leaving ~73px of clearance; 45px keeps a healthy margin).
const MAIN_FACEOFF_ZONE_RADIUS = 75;
const NEUTRAL_FACEOFF_ZONE_RADIUS = 45;

const FACEOFF_DOTS = [
  { x: 100, y: 42.5, zoneRadius: MAIN_FACEOFF_ZONE_RADIUS },     // Center Ice
  { x: 31, y: 20.5, zoneRadius: MAIN_FACEOFF_ZONE_RADIUS },      // Left Top End
  { x: 31, y: 64.5, zoneRadius: MAIN_FACEOFF_ZONE_RADIUS },      // Left Bottom End
  { x: 169, y: 20.5, zoneRadius: MAIN_FACEOFF_ZONE_RADIUS },     // Right Top End
  { x: 169, y: 64.5, zoneRadius: MAIN_FACEOFF_ZONE_RADIUS },     // Right Bottom End
  { x: 80, y: 20.5, zoneRadius: NEUTRAL_FACEOFF_ZONE_RADIUS },   // Left Top Neutral
  { x: 80, y: 64.5, zoneRadius: NEUTRAL_FACEOFF_ZONE_RADIUS },   // Left Bottom Neutral
  { x: 120, y: 20.5, zoneRadius: NEUTRAL_FACEOFF_ZONE_RADIUS },  // Right Top Neutral
  { x: 120, y: 64.5, zoneRadius: NEUTRAL_FACEOFF_ZONE_RADIUS },  // Right Bottom Neutral
];

const CIRCLE_DOTS = [
  { x: 100, y: 42.5 },   // Center Ice
  { x: 31, y: 20.5 },    // Left Top End
  { x: 31, y: 64.5 },    // Left Bottom End
  { x: 169, y: 20.5 },   // Right Top End
  { x: 169, y: 64.5 },   // Right Bottom End
];

const ZONE_ENTRY_TYPES = [
  EventType.ZONE_ENTRY_CARRY,
  EventType.ZONE_ENTRY_DUMP,
  EventType.ZONE_ENTRY_PASS,
  EventType.ZONE_ENTRY_DENIED,
];

// Blue line x-positions in "unit" space (the coordinate system used by
// click handling and FACEOFF_DOTS, i.e. before the *5 scaling used only for
// rendering). Mirrors blueLineOffset (375px) declared inside the component.
const LEFT_BLUE_LINE_X = 75;   // 375 / 5
const RIGHT_BLUE_LINE_X = 125; // (1000 - 375) / 5

// Shape used for each zone entry type's dot. Deliberately keyed off event
// type (not the generic style.shape field) so this never touches how HIT
// or any other existing event renders.
const ZONE_ENTRY_SHAPES: Partial<Record<EventType, 'triangle' | 'square' | 'diamond' | 'x'>> = {
  [EventType.ZONE_ENTRY_CARRY]: 'triangle',
  [EventType.ZONE_ENTRY_DUMP]: 'square',
  [EventType.ZONE_ENTRY_PASS]: 'diamond',
  [EventType.ZONE_ENTRY_DENIED]: 'x',
};

// Renders the shape marker for a zone entry dot. Kept separate from the
// default circle rendering used by every other event type.
const EntryMarker: React.FC<{
  shape: 'triangle' | 'square' | 'diamond' | 'x';
  cx: number; cy: number; size: number; color: string; isAway: boolean; pointRight: boolean;
}> = ({ shape, cx, cy, size, color, isAway, pointRight }) => {
  const stroke = isAway ? '#ffffff' : 'none';
  const strokeWidth = isAway ? 1.5 : 0;

  if (shape === 'triangle') {
    // Points toward the attacking zone (away from centre ice) so entry
    // direction is legible at a glance.
    const s = size * 1.4;
    const points = pointRight
      ? `${cx - s * 0.6},${cy - s} ${cx - s * 0.6},${cy + s} ${cx + s},${cy}`
      : `${cx + s * 0.6},${cy - s} ${cx + s * 0.6},${cy + s} ${cx - s},${cy}`;
    return <polygon points={points} fill={color} stroke={stroke} strokeWidth={strokeWidth} className="drop-shadow-lg" />;
  }
  if (shape === 'square') {
    const s = size * 1.8;
    return <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} fill={color} stroke={stroke} strokeWidth={strokeWidth} className="drop-shadow-lg" />;
  }
  if (shape === 'diamond') {
    const s = size * 1.3;
    const points = `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`;
    return <polygon points={points} fill={color} stroke={stroke} strokeWidth={strokeWidth} className="drop-shadow-lg" />;
  }
  // 'x' — denied entry
  const s = size * 1.1;
  return (
    <g>
      <line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <line x1={cx - s} y1={cy + s} x2={cx + s} y2={cy - s} stroke={color} strokeWidth={3} strokeLinecap="round" />
      {isAway && <circle cx={cx} cy={cy} r={s + 3} fill="none" stroke="#ffffff" strokeWidth={1.5} opacity={0.7} />}
    </g>
  );
};

// Renders a shot dot with a small inner glyph showing the result — a green
// checkmark for shots that reached the net, a red X for attempts that
// didn't (missed/blocked). Color of the dot itself already encodes
// strength (ES/PP/PK) via getEventStyle; this just adds the result on top.
const ShotMarker: React.FC<{
  cx: number; cy: number; size: number; color: string; isAway: boolean; onNet: boolean;
}> = ({ cx, cy, size, color, isAway, onNet }) => {
  const stroke = isAway ? '#ffffff' : 'none';
  const strokeWidth = isAway ? 1.5 : 0;
  const s = size * 0.55;

  return (
    <g>
      <circle cx={cx} cy={cy} r={size} fill={color} stroke={stroke} strokeWidth={strokeWidth} className="drop-shadow-lg" />
      {onNet ? (
        <path
          d={`M ${cx - s * 0.55} ${cy - s * 0.05} L ${cx - s * 0.1} ${cy + s * 0.45} L ${cx + s * 0.6} ${cy - s * 0.5}`}
          fill="none" stroke="#ffffff" strokeWidth={size * 0.3} strokeLinecap="round" strokeLinejoin="round"
        />
      ) : (
        <>
          <line x1={cx - s * 0.5} y1={cy - s * 0.5} x2={cx + s * 0.5} y2={cy + s * 0.5} stroke="#ef4444" strokeWidth={size * 0.28} strokeLinecap="round" />
          <line x1={cx - s * 0.5} y1={cy + s * 0.5} x2={cx + s * 0.5} y2={cy - s * 0.5} stroke="#ef4444" strokeWidth={size * 0.28} strokeLinecap="round" />
        </>
      )}
    </g>
  );
};

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
      // Click coords (px, py) are in unit space; zoneRadius is stored in the
      // *5-scaled px space used for rendering, so convert before comparing.
      const withinZone = minDistance <= closestDot.zoneRadius / 5;
      if (!withinZone) {
        return; // click missed every dot's clickable zone — don't plot
      }
      px = closestDot.x; py = closestDot.y; // snap to the dot's centre
    }

    const isZoneEntry = ZONE_ENTRY_TYPES.includes(activeEventType as EventType);
    if (isZoneEntry) {
      // Snap only the x-axis to whichever blue line is nearer — entries
      // don't happen at fixed spots like faceoffs, so we don't snap y.
      // Keeping the real y click position preserves entry lane (middle
      // vs. down the wall), which is the whole point of tracking this.
      px = Math.abs(px - LEFT_BLUE_LINE_X) < Math.abs(px - RIGHT_BLUE_LINE_X) ? LEFT_BLUE_LINE_X : RIGHT_BLUE_LINE_X;
      py = Math.max(4, Math.min(81, py)); // clamp to rink bounds
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
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const getEventStyle = (event: GameEvent) => {
    // Event-specific colors
    const SHOT_CYAN = '#06b6d4';
    const GOAL_GREEN = '#22c55e';
    const GIVEAWAY_ORANGE = '#f97316';
    const TAKEAWAY_TEAL = '#14b8a6';
    const PENALTY_RED = '#ef4444';
    const HIT_GRAY = '#a855f7';
    const BLOCK_SLATE = '#94a3b8';
    const PP_FOR_GOLD = '#eab308';
    const PP_AGAINST_PINK = '#ec4899';
    const ENTRY_CARRY_INDIGO = '#4f46e5';
    const ENTRY_DUMP_AMBER = '#d97706';
    const ENTRY_PASS_SKY = '#0ea5e9';
    const ENTRY_DENIED_ROSE = '#e11d48';

    switch (event.type) {
      case EventType.GOAL: 
        return { color: GOAL_GREEN, size: 9, glow: true, opacity: 1 };
      case EventType.SHOT: {
        const strength = event.metadata?.strength;
        const color = strength === 'PP' ? PP_FOR_GOLD : strength === 'PK' ? PP_AGAINST_PINK : SHOT_CYAN;
        return { color, size: 7, opacity: 1 };
      }
      case EventType.BLOCK:
        return { color: BLOCK_SLATE, size: 6, opacity: 0.8 };
      case EventType.PP_SHOT_FOR:
        return { color: PP_FOR_GOLD, size: 7, glow: false, opacity: 1 };
      case EventType.PP_SHOT_AGAINST:
        return { color: PP_AGAINST_PINK, size: 7, glow: false, opacity: 1 };
      case EventType.GIVEAWAY: 
        return { color: GIVEAWAY_ORANGE, size: 6, opacity: 0.8 };
      case EventType.TAKEAWAY: 
        return { color: TAKEAWAY_TEAL, size: 6, opacity: 0.8 };
      case EventType.PENALTY: 
        return { color: PENALTY_RED, size: 8, glow: true, opacity: 1 };
      case EventType.FACEOFF_WIN: 
        return { color: '#ffffff', size: 7, opacity: 1 }; 
      case EventType.FACEOFF_LOSS: 
        return { color: 'none', size: 4, opacity: 0.4 };
      case EventType.HIT: 
        return { color: HIT_GRAY, size: 5, opacity: 0.85, shape: 'diamond' };
      case EventType.ZONE_ENTRY_CARRY:
        return { color: ENTRY_CARRY_INDIGO, size: 6, opacity: 1 };
      case EventType.ZONE_ENTRY_DUMP:
        return { color: ENTRY_DUMP_AMBER, size: 6, opacity: 0.9 };
      case EventType.ZONE_ENTRY_PASS:
        return { color: ENTRY_PASS_SKY, size: 6, opacity: 1 };
      case EventType.ZONE_ENTRY_DENIED:
        return { color: ENTRY_DENIED_ROSE, size: 5, opacity: 0.85 };
      default: 
        return { color: '#ffffff', size: 5, opacity: 0.8 };
    }
  };

  const BRIGHT_RED = "#ff0000";
  const BRIGHT_BLUE = "#2563eb";
  const SOLID_CREASE_BLUE = "#4182f9";
  const AWAY_RING_WHITE = "#ffffff";
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
  const isZoneEntryToolActive = ZONE_ENTRY_TYPES.includes(activeEventType as EventType);

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
      <svg viewBox={`0 0 ${rinkWidth} ${rinkHeight}`} className="w-full h-full cursor-crosshair select-none touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
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
            opacity="0.18" 
            preserveAspectRatio="xMidYMid meet"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {rightLogo && (
          <image 
            href={rightLogo} 
            x={rightLogoX} y={logoY} 
            width={watermarkLogoSize} height={watermarkLogoSize} 
            opacity="0.18" 
            preserveAspectRatio="xMidYMid meet"
            style={{ pointerEvents: 'none' }}
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
        <line 
          x1={blueLineOffset} y1="5" x2={blueLineOffset} y2="420" 
          stroke={BRIGHT_BLUE} 
          strokeWidth={isZoneEntryToolActive ? 12 : 8} 
          opacity={isZoneEntryToolActive ? 1 : 0.8} 
          className="transition-all duration-300"
        />
        <line 
          x1={rinkWidth - blueLineOffset} y1="5" x2={rinkWidth - blueLineOffset} y2="420" 
          stroke={BRIGHT_BLUE} 
          strokeWidth={isZoneEntryToolActive ? 12 : 8} 
          opacity={isZoneEntryToolActive ? 1 : 0.8} 
          className="transition-all duration-300"
        />
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

        {/* Top Cheese Hockey logo — centre ice circle */}
        <image
          href="/Top_Cheese_Hockey_logo.png"
          x={500 - 55} y={212.5 - 55}
          width={110} height={110}
          opacity="0.18"
          preserveAspectRatio="xMidYMid meet"
          style={{ pointerEvents: 'none' }}
        />

        {events.map(e => {
          if (!e.coordinates) return null;
          const style = getEventStyle(e);
          const cx = e.coordinates.x * 5;
          const cy = e.coordinates.y * 5;
          const isDragging = draggingRef.current?.id === e.id;
          // NOTE: assumes GameEvent has a `team` field of type Team with an
          // AWAY member (imported from '../types'). Adjust this condition
          // if your away-team indicator is named/typed differently.
          const isAway = e.team === Team.AWAY;
          const entryShape = ZONE_ENTRY_SHAPES[e.type];
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
              {e.type === EventType.SHOT ? (
                <ShotMarker
                  cx={cx} cy={cy}
                  size={style.size}
                  color={style.color}
                  isAway={isAway}
                  onNet={e.metadata?.onNet !== false}
                />
              ) : entryShape ? (
                <EntryMarker 
                  shape={entryShape} 
                  cx={cx} cy={cy} 
                  size={style.size} 
                  color={style.color} 
                  isAway={isAway} 
                  pointRight={cx > centerLineX}
                />
              ) : (
                <circle 
                  cx={cx} cy={cy} 
                  r={style.size} 
                  fill={style.color} 
                  fillOpacity={style.opacity}
                  stroke={isAway ? AWAY_RING_WHITE : 'none'}
                  strokeWidth={isAway ? 1.5 : 0}
                  className="drop-shadow-lg"
                  filter={style.glow ? "url(#glow-filter)" : undefined}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default RinkChart;
