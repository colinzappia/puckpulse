import { GameEvent, EventType, Team, TeamStats, Player } from '../types';
import { buildPlayerStats, computeGoalieStats, computeZonePlayStats } from '../components/playerstats';
const getPeriodLabel = (p: number): string => {
  if (p === 1) return '1st';
  if (p === 2) return '2nd';
  if (p === 3) return '3rd';
  if (p === 4) return 'OT';
  if (p >= 5) return `OT${p - 3}`;
  return String(p);
};
import * as XLSX from 'xlsx';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface GoalieStint { number: string; since: number; }

interface ExportData {
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  events: GameEvent[];
  stats: { home: TeamStats; away: TeamStats };
  summaries: Record<string, string>;
  maxPeriod: number;
  homeRoster: Player[];
  awayRoster: Player[];
  goalieHistoryHome?: GoalieStint[];
  goalieHistoryAway?: GoalieStint[];
}

// ── Design tokens — shared across PDF and HTML so they stay visually consistent ──
const INK = '#0f172a';
const HOME_COLOR = '#2563eb';
const AWAY_COLOR = '#dc2626';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const getEventColor = (type: EventType) => {
  switch (type) {
    case EventType.GOAL: return '#22c55e';
    case EventType.SHOT: return '#ffffff';
    case EventType.PP_SHOT_FOR: return '#eab308';
    case EventType.PP_SHOT_AGAINST: return '#ec4899';
    case EventType.GIVEAWAY: return '#f97316';
    case EventType.TAKEAWAY: return '#14b8a6';
    case EventType.PENALTY: return '#ef4444';
    case EventType.HIT: return '#64748b';
    case EventType.ZONE_ENTRY_CARRY: return '#4f46e5';
    case EventType.ZONE_ENTRY_DUMP: return '#d97706';
    case EventType.ZONE_ENTRY_PASS: return '#0ea5e9';
    case EventType.ZONE_ENTRY_DENIED: return '#e11d48';
    default: return '#ffffff';
  }
};

const renderRinkSVG = (periodEvents: GameEvent[]) => {
  const rinkWidth = 1000;
  const rinkHeight = 425;
  const goalLineOffset = 55;
  const centerLineX = 500;
  const blueLineOffset = 375;

  let eventCircles = periodEvents.map(e => {
    if (!e.coordinates) return '';
    const color = getEventColor(e.type);
    const size = e.type === EventType.GOAL ? 10 : 6;
    const cx = e.coordinates.x * 5;
    const cy = e.coordinates.y * 5;
    return `<circle cx="${cx}" cy="${cy}" r="${size}" fill="${color}" stroke="#000" stroke-width="1" />`;
  }).join('');

  return `
    <svg viewBox="0 0 ${rinkWidth} ${rinkHeight}" style="width:100%; height:auto; background:#111; border-radius:24px; border:2px solid #333;">
      <rect x="5" y="5" width="990" height="415" rx="140" ry="140" fill="none" stroke="#444" stroke-width="2" />
      <line x1="${centerLineX}" y1="5" x2="${centerLineX}" y2="420" stroke="#f00" stroke-width="4" />
      <line x1="${blueLineOffset}" y1="5" x2="${blueLineOffset}" y2="420" stroke="#2563eb" stroke-width="6" />
      <line x1="${rinkWidth - blueLineOffset}" y1="5" x2="${rinkWidth - blueLineOffset}" y2="420" stroke="#2563eb" stroke-width="6" />
      <line x1="${goalLineOffset}" y1="35" x2="${goalLineOffset}" y2="390" stroke="#f00" stroke-width="2" />
      <line x1="${rinkWidth - goalLineOffset}" y1="35" x2="${rinkWidth - goalLineOffset}" y2="390" stroke="#f00" stroke-width="2" />
      ${eventCircles}
    </svg>
  `;
};

// ── Comprehensive per-team stat aggregation, shared by every export format ──
function computeTeamReportStats(events: GameEvent[], roster: Player[], team: Team, goalieHistory: GoalieStint[] | undefined) {
  const rows = buildPlayerStats(events, roster, team);
  const goals = rows.reduce((s, r) => s + r.goals, 0);
  const assists = rows.reduce((s, r) => s + r.assists, 0);
  const shotsOnNet = rows.reduce((s, r) => s + r.shotsOnNet, 0);
  const shotsMissed = rows.reduce((s, r) => s + r.shotsMissed, 0);
  const hits = rows.reduce((s, r) => s + r.hits, 0);
  const blocks = rows.reduce((s, r) => s + r.blocks, 0);
  const faceoffWins = rows.reduce((s, r) => s + r.faceoffWins, 0);
  const faceoffLosses = rows.reduce((s, r) => s + r.faceoffLosses, 0);
  const faceoffTotal = faceoffWins + faceoffLosses;
  const faceoffPct = faceoffTotal > 0 ? faceoffWins / faceoffTotal : null;
  const shootingPct = shotsOnNet > 0 ? goals / shotsOnNet : null;

  const teamEvents = events.filter(e => e.team === team);
  const penaltyEvents = teamEvents.filter(e => e.type === EventType.PENALTY);
  const pim = penaltyEvents.reduce((s, e) => s + (Number(e.metadata?.minutes) || 0), 0);
  const ppGoals = teamEvents.filter(e => e.type === EventType.GOAL && e.metadata?.strength === 'PP').length;
  const ppShots = rows.reduce((s, r) => s + r.ppShots, 0);
  const pkShots = rows.reduce((s, r) => s + r.pkShots, 0);

  const zonePlay = computeZonePlayStats(events, team);

  let goalieStints: ReturnType<typeof computeGoalieStats> = [];
  let teamSaves = 0, teamShotsAgainst = 0, teamGoalsAgainst = 0;
  const opponent = team === Team.HOME ? Team.AWAY : Team.HOME;
  if (goalieHistory && goalieHistory.length > 0) {
    goalieStints = computeGoalieStats(events, goalieHistory, team, roster);
    teamSaves = goalieStints.reduce((s, g) => s + g.saves, 0);
    teamShotsAgainst = goalieStints.reduce((s, g) => s + g.shotsAgainst, 0);
    teamGoalsAgainst = goalieStints.reduce((s, g) => s + g.goalsAgainst, 0);
  } else {
    teamShotsAgainst = events.filter(e => e.team === opponent && e.type === EventType.SHOT && e.metadata?.onNet !== false).length;
    teamGoalsAgainst = events.filter(e => e.team === opponent && e.type === EventType.GOAL).length;
    teamSaves = Math.max(0, teamShotsAgainst - teamGoalsAgainst);
  }
  const teamSvPct = teamShotsAgainst > 0 ? teamSaves / teamShotsAgainst : null;

  const periodGoals: Record<number, number> = {};
  teamEvents.filter(e => e.type === EventType.GOAL).forEach(e => {
    periodGoals[e.period] = (periodGoals[e.period] || 0) + 1;
  });

  return {
    rows, goals, assists, shotsOnNet, shotsMissed, hits, blocks, faceoffWins, faceoffLosses, faceoffPct, shootingPct,
    pim, penaltyCount: penaltyEvents.length, ppGoals, ppShots, pkShots,
    zonePlay, goalieStints, teamSaves, teamShotsAgainst, teamGoalsAgainst, teamSvPct,
    periodGoals,
  };
}

const pct = (v: number | null, decimals = 1) => v === null ? '—' : `${(v * 100).toFixed(decimals)}%`;
const svPct = (v: number | null) => v === null ? '—' : `.${Math.round(v * 1000)}`;
const pm = (v: number) => v > 0 ? `+${v}` : String(v);

// ── Shared HTML builders — identical between PDF and HTML export ──

function renderTeamComparisonTable(homeName: string, awayName: string, h: ReturnType<typeof computeTeamReportStats>, a: ReturnType<typeof computeTeamReportStats>) {
  const row = (label: string, homeVal: string | number, awayVal: string | number) => `
    <tr>
      <td style="padding:9px 14px; text-align:right; font-weight:700; color:${HOME_COLOR}; width:30%;">${homeVal}</td>
      <td style="padding:9px 14px; text-align:center; font-size:10px; font-weight:700; color:${MUTED}; text-transform:uppercase; letter-spacing:0.05em; width:40%;">${label}</td>
      <td style="padding:9px 14px; text-align:left; font-weight:700; color:${AWAY_COLOR}; width:30%;">${awayVal}</td>
    </tr>`;
  return `
    <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:8px;">
      <thead>
        <tr>
          <th style="padding:10px 14px; text-align:right; font-size:13px; font-weight:900; color:${HOME_COLOR}; text-transform:uppercase; border-bottom:2px solid ${INK};">${homeName}</th>
          <th style="border-bottom:2px solid ${INK};"></th>
          <th style="padding:10px 14px; text-align:left; font-size:13px; font-weight:900; color:${AWAY_COLOR}; text-transform:uppercase; border-bottom:2px solid ${INK};">${awayName}</th>
        </tr>
      </thead>
      <tbody>
        ${row('Goals', h.goals, a.goals)}
        ${row('Shots on Net', h.shotsOnNet, a.shotsOnNet)}
        ${row('Shooting %', pct(h.shootingPct), pct(a.shootingPct))}
        ${row('Save %', svPct(h.teamSvPct), svPct(a.teamSvPct))}
        ${row('Hits', h.hits, a.hits)}
        ${row('Blocked Shots', h.blocks, a.blocks)}
        ${row('Penalty Minutes', h.pim, a.pim)}
        ${row('Power Play Goals', h.ppGoals, a.ppGoals)}
        ${row('Faceoff Record', `${h.faceoffWins}-${h.faceoffLosses}`, `${a.faceoffWins}-${a.faceoffLosses}`)}
        ${row('Faceoff %', pct(h.faceoffPct), pct(a.faceoffPct))}
      </tbody>
    </table>`;
}

function renderScoringSummary(homeName: string, awayName: string, maxPeriod: number, h: ReturnType<typeof computeTeamReportStats>, a: ReturnType<typeof computeTeamReportStats>) {
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);
  const headerCells = periods.map(p => `<th style="padding:8px 12px; text-align:center; font-size:10px; font-weight:900; color:${MUTED}; text-transform:uppercase; border-bottom:2px solid ${INK};">${getPeriodLabel(p)}</th>`).join('');
  const homeCells = periods.map(p => `<td style="padding:8px 12px; text-align:center; font-weight:700;">${h.periodGoals[p] || 0}</td>`).join('');
  const awayCells = periods.map(p => `<td style="padding:8px 12px; text-align:center; font-weight:700;">${a.periodGoals[p] || 0}</td>`).join('');
  return `
    <table style="border-collapse:collapse; font-size:13px; margin-bottom:8px;">
      <thead><tr>
        <th style="padding:8px 14px; text-align:left; border-bottom:2px solid ${INK};"></th>
        ${headerCells}
        <th style="padding:8px 14px; text-align:center; font-size:10px; font-weight:900; color:${INK}; text-transform:uppercase; border-bottom:2px solid ${INK};">Final</th>
      </tr></thead>
      <tbody>
        <tr>
          <td style="padding:8px 14px; font-weight:900; color:${HOME_COLOR};">${homeName}</td>
          ${homeCells}
          <td style="padding:8px 14px; text-align:center; font-weight:900; font-size:16px; color:${HOME_COLOR};">${h.goals}</td>
        </tr>
        <tr>
          <td style="padding:8px 14px; font-weight:900; color:${AWAY_COLOR};">${awayName}</td>
          ${awayCells}
          <td style="padding:8px 14px; text-align:center; font-weight:900; font-size:16px; color:${AWAY_COLOR};">${a.goals}</td>
        </tr>
      </tbody>
    </table>`;
}

function renderPlayerStatsTable(teamName: string, color: string, s: ReturnType<typeof computeTeamReportStats>) {
  const skaters = s.rows.filter(r => r.position !== 'G' && r.total > 0).sort((x, y) => (y.goals + y.assists) - (x.goals + x.assists));
  if (skaters.length === 0) return '';
  const dataRows = skaters.map((r, i) => `
    <tr style="background:${i % 2 === 1 ? '#f8fafc' : 'transparent'};">
      <td style="padding:7px 10px; font-weight:700; border-bottom:1px solid ${BORDER};">#${r.number} ${r.name}</td>
      <td style="padding:7px 10px; text-align:center; border-bottom:1px solid ${BORDER};">${r.goals}</td>
      <td style="padding:7px 10px; text-align:center; border-bottom:1px solid ${BORDER};">${r.assists}</td>
      <td style="padding:7px 10px; text-align:center; font-weight:900; border-bottom:1px solid ${BORDER};">${r.goals + r.assists}</td>
      <td style="padding:7px 10px; text-align:center; border-bottom:1px solid ${BORDER};">${r.shotsOnNet}</td>
      <td style="padding:7px 10px; text-align:center; border-bottom:1px solid ${BORDER};">${r.shotsOnNet > 0 ? pct(r.goals / r.shotsOnNet, 0) : '—'}</td>
      <td style="padding:7px 10px; text-align:center; border-bottom:1px solid ${BORDER};">${r.hits}</td>
      <td style="padding:7px 10px; text-align:center; border-bottom:1px solid ${BORDER};">${r.penalties}</td>
      <td style="padding:7px 10px; text-align:center; border-bottom:1px solid ${BORDER};">${r.faceoffWins + r.faceoffLosses > 0 ? `${r.faceoffWins}-${r.faceoffLosses}` : '—'}</td>
      <td style="padding:7px 10px; text-align:center; border-bottom:1px solid ${BORDER};">${r.blocks}</td>
      <td style="padding:7px 10px; text-align:center; font-weight:700; color:${r.plusMinus > 0 ? '#16a34a' : r.plusMinus < 0 ? '#dc2626' : MUTED}; border-bottom:1px solid ${BORDER};">${pm(r.plusMinus)}</td>
    </tr>`).join('');

  return `
    <h3 style="font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; color:${color}; margin:0 0 8px; padding-left:10px; border-left:4px solid ${color};">${teamName}</h3>
    <table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:24px;">
      <thead>
        <tr style="background:${INK};">
          <th style="padding:7px 10px; text-align:left; color:#fff; font-weight:700;">Player</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">G</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">A</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">PTS</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">SOG</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">S%</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">HIT</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">PIM</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">FO</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">BLK</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">+/-</th>
        </tr>
      </thead>
      <tbody>${dataRows}</tbody>
    </table>`;
}

function renderGoalieTable(teamName: string, color: string, s: ReturnType<typeof computeTeamReportStats>) {
  if (s.goalieStints.length === 0) return '';
  const rows = s.goalieStints.map(g => `
    <tr>
      <td style="padding:7px 10px; font-weight:700; border-bottom:1px solid ${BORDER};">#${g.number} ${g.name}</td>
      <td style="padding:7px 10px; text-align:center; border-bottom:1px solid ${BORDER};">${g.shotsAgainst}</td>
      <td style="padding:7px 10px; text-align:center; border-bottom:1px solid ${BORDER};">${g.goalsAgainst}</td>
      <td style="padding:7px 10px; text-align:center; border-bottom:1px solid ${BORDER};">${g.saves}</td>
      <td style="padding:7px 10px; text-align:center; font-weight:900; color:${color}; border-bottom:1px solid ${BORDER};">${svPct(g.savePct)}</td>
    </tr>`).join('');
  return `
    <h3 style="font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; color:${color}; margin:0 0 8px; padding-left:10px; border-left:4px solid ${color};">${teamName} Goaltending</h3>
    <table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:24px;">
      <thead>
        <tr style="background:${INK};">
          <th style="padding:7px 10px; text-align:left; color:#fff; font-weight:700;">Goalie</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">SA</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">GA</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">SV</th>
          <th style="padding:7px 10px; color:#fff; font-weight:700;">SV%</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderZonePlaySection(homeName: string, awayName: string, h: ReturnType<typeof computeTeamReportStats>, a: ReturnType<typeof computeTeamReportStats>) {
  if (!h.zonePlay && !a.zonePlay) return '';
  const zp = h.zonePlay || a.zonePlay;
  const row = (label: string, hv: string | number, av: string | number) => `
    <tr>
      <td style="padding:8px 14px; text-align:right; font-weight:700; color:${HOME_COLOR};">${hv}</td>
      <td style="padding:8px 14px; text-align:center; font-size:10px; font-weight:700; color:${MUTED}; text-transform:uppercase;">${label}</td>
      <td style="padding:8px 14px; text-align:left; font-weight:700; color:${AWAY_COLOR};">${av}</td>
    </tr>`;
  return `
    <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:8px;">
      <tbody>
        ${row('Zone Entries — Carry', h.zonePlay?.carry ?? 0, a.zonePlay?.carry ?? 0)}
        ${row('Zone Entries — Dump', h.zonePlay?.dump ?? 0, a.zonePlay?.dump ?? 0)}
        ${row('Zone Entries — Pass', h.zonePlay?.pass ?? 0, a.zonePlay?.pass ?? 0)}
        ${row('Zone Entries — Denied', h.zonePlay?.denied ?? 0, a.zonePlay?.denied ?? 0)}
        ${row('Dump-in Retrieval %', pct(h.zonePlay?.retrievalPct ?? null), pct(a.zonePlay?.retrievalPct ?? null))}
        ${row('Breakout Success %', pct(h.zonePlay?.breakoutPct ?? null), pct(a.zonePlay?.breakoutPct ?? null))}
      </tbody>
    </table>`;
}

function reportStyles() {
  return `font-family: ${FONT}; color: ${INK};`;
}

function buildReportHTML(data: ExportData, forPdf: boolean) {
  const dateStr = new Date().toLocaleDateString();
  const h = computeTeamReportStats(data.events, data.homeRoster, Team.HOME, data.goalieHistoryHome);
  const a = computeTeamReportStats(data.events, data.awayRoster, Team.AWAY, data.goalieHistoryAway);

  let periodSections = '';
  for (let p = 1; p <= data.maxPeriod; p++) {
    const pEvents = data.events.filter(e => e.period === p);
    if (pEvents.length === 0 && p > 1) continue;
    periodSections += `
      <section style="margin-bottom: 32px; ${forPdf ? 'page-break-inside: avoid;' : ''}">
        <h3 style="font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 10px; padding-left:10px; border-left:4px solid ${INK};">${getPeriodLabel(p)} Period</h3>
        <div style="margin-bottom: 10px;">${renderRinkSVG(pEvents)}</div>
        <div style="background: #f8fafc; padding: 16px 18px; border-radius: 12px; border: 1px solid ${BORDER}; font-size: 12px; line-height:1.6; white-space: pre-line;">
          ${data.summaries[p] || 'No AI tactical analysis generated for this period.'}
        </div>
      </section>`;
  }

  const logoImg = (url?: string) => (!forPdf && url) ? `<img src="${url}" style="height:36px; object-fit:contain; margin-bottom:6px;" />` : '';

  return `
    <div style="${reportStyles()} padding: ${forPdf ? '36px' : '0'};">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:5px solid ${INK}; padding-bottom:18px; margin-bottom:28px;">
        <div>
          <p style="margin:0 0 4px; font-size:10px; font-weight:900; letter-spacing:0.15em; color:${MUTED}; text-transform:uppercase;">🏒 Top Cheese Hockey</p>
          <h1 style="margin:0; font-size:26px; font-weight:900; letter-spacing:-0.01em;">Game Summary Report</h1>
        </div>
        <div style="text-align:right; font-size:10px; font-weight:700; color:${MUTED};">${dateStr}</div>
      </div>

      <div style="display:flex; align-items:center; justify-content:center; gap:28px; margin-bottom:32px; padding: 20px 0;">
        <div style="text-align:center; flex:1;">
          ${logoImg(data.homeLogo)}
          <div style="font-size:12px; font-weight:900; color:${HOME_COLOR}; text-transform:uppercase; letter-spacing:0.03em;">${data.homeName}</div>
          <div style="font-size:56px; font-weight:900; line-height:1;">${h.goals}</div>
        </div>
        <div style="font-size:20px; font-weight:900; color:${MUTED};">FINAL</div>
        <div style="text-align:center; flex:1;">
          ${logoImg(data.awayLogo)}
          <div style="font-size:12px; font-weight:900; color:${AWAY_COLOR}; text-transform:uppercase; letter-spacing:0.03em;">${data.awayName}</div>
          <div style="font-size:56px; font-weight:900; line-height:1;">${a.goals}</div>
        </div>
      </div>

      <div style="display:flex; justify-content:center; margin-bottom:32px;">${renderScoringSummary(data.homeName, data.awayName, data.maxPeriod, h, a)}</div>

      ${data.summaries['total'] ? `
      <h2 style="font-size:15px; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; border-left:4px solid ${INK}; padding-left:10px; margin:0 0 12px;">Game Overview</h2>
      <div style="background:#f8fafc; padding:18px 20px; border-radius:12px; border:1px solid ${BORDER}; font-size:13px; line-height:1.7; margin-bottom:32px;">
        ${data.summaries['total']}
      </div>` : ''}

      <h2 style="font-size:15px; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; border-left:4px solid ${INK}; padding-left:10px; margin:0 0 16px;">Team Comparison</h2>
      <div style="display:flex; justify-content:center; margin-bottom:32px;">${renderTeamComparisonTable(data.homeName, data.awayName, h, a)}</div>

      <h2 style="font-size:15px; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; border-left:4px solid ${INK}; padding-left:10px; margin:0 0 16px; ${forPdf ? 'page-break-before: always; padding-top:20px;' : ''}">Player Stats</h2>
      ${renderPlayerStatsTable(data.homeName, HOME_COLOR, h)}
      ${renderPlayerStatsTable(data.awayName, AWAY_COLOR, a)}

      <h2 style="font-size:15px; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; border-left:4px solid ${INK}; padding-left:10px; margin:24px 0 16px;">Goaltending</h2>
      ${renderGoalieTable(data.homeName, HOME_COLOR, h)}
      ${renderGoalieTable(data.awayName, AWAY_COLOR, a)}

      <h2 style="font-size:15px; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; border-left:4px solid ${INK}; padding-left:10px; margin:8px 0 16px;">Special Teams &amp; Zone Play</h2>
      <div style="display:flex; justify-content:center; margin-bottom:32px;">${renderZonePlaySection(data.homeName, data.awayName, h, a)}</div>

      <h2 style="font-size:15px; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; border-left:4px solid ${INK}; padding-left:10px; margin:0 0 16px; ${forPdf ? 'page-break-before: always; padding-top:20px;' : ''}">Period Breakdown</h2>
      ${periodSections}
    </div>`;
}

export async function downloadPDFReport(data: ExportData) {
  // IMPORTANT: the report container itself must stay in completely normal
  // document flow — no position:fixed/absolute or z-index tricks on it
  // directly. Verified empirically: html2canvas measures a
  // position:fixed OR position:absolute element as having zero height
  // when cloning the document for rendering, producing a blank capture,
  // regardless of z-index. Hiding it via a wrapping element instead (zero
  // height, overflow hidden) keeps the report's own layout/auto-sizing
  // completely normal while still keeping it off-screen.
  const reportContainer = document.createElement('div');
  reportContainer.style.width = '800px';
  reportContainer.style.background = '#fff';
  reportContainer.innerHTML = buildReportHTML(data, true);

  const hiddenWrapper = document.createElement('div');
  hiddenWrapper.style.height = '0';
  hiddenWrapper.style.overflow = 'hidden';
  hiddenWrapper.appendChild(reportContainer);
  document.body.appendChild(hiddenWrapper);

  const opt = {
    margin: 0,
    filename: `TopCheeseHockey-Report-${data.homeName}-vs-${data.awayName}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  try {
    const exporter = typeof html2pdf === 'function' ? html2pdf : (html2pdf as any).default;
    if (!exporter) throw new Error('PDF library failed to load — try refreshing the page.');
    await exporter().set(opt).from(reportContainer).save();
  } catch (err: any) {
    console.error("PDF Generation Error:", err);
    throw new Error(err?.message || 'Could not generate the PDF. Please try again.');
  } finally {
    document.body.removeChild(hiddenWrapper);
  }
}

export function downloadHTMLExport(data: ExportData) {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Top Cheese Hockey Report - ${data.homeName} vs ${data.awayName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        body { font-family: ${FONT}; margin: 0; padding: 0; background: #f1f5f9; line-height: 1.5; }
        .container { max-width: 880px; margin: 40px auto; background: #fff; padding: 44px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
        @media print {
          body { background: #fff; }
          .container { margin: 0; padding: 20px; width: 100%; max-width: none; border-radius: 0; box-shadow: none; }
        }
        table { width: 100%; }
      </style>
    </head>
    <body>
      <div class="container">${buildReportHTML(data, false)}</div>
    </body>
    </html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TopCheeseHockey-Report-${data.homeName}-vs-${data.awayName}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadExcelReport(data: ExportData) {
  const h = computeTeamReportStats(data.events, data.homeRoster, Team.HOME, data.goalieHistoryHome);
  const a = computeTeamReportStats(data.events, data.awayRoster, Team.AWAY, data.goalieHistoryAway);
  const wb = XLSX.utils.book_new();

  // 1. Overview
  const summaryData = [
    ["TOP CHEESE HOCKEY — GAME SUMMARY", ""],
    ["Date", new Date().toLocaleDateString()],
    ["Teams", `${data.homeName} vs ${data.awayName}`],
    ["", ""],
    ["STATISTIC", data.homeName, data.awayName],
    ["Goals", h.goals, a.goals],
    ["Shots on Net", h.shotsOnNet, a.shotsOnNet],
    ["Shooting %", h.shootingPct !== null ? `${(h.shootingPct * 100).toFixed(1)}%` : '—', a.shootingPct !== null ? `${(a.shootingPct * 100).toFixed(1)}%` : '—'],
    ["Save %", h.teamSvPct !== null ? svPct(h.teamSvPct) : '—', a.teamSvPct !== null ? svPct(a.teamSvPct) : '—'],
    ["Hits", h.hits, a.hits],
    ["Blocked Shots", h.blocks, a.blocks],
    ["Penalty Minutes", h.pim, a.pim],
    ["Power Play Goals", h.ppGoals, a.ppGoals],
    ["Faceoff Wins", h.faceoffWins, a.faceoffWins],
    ["Faceoff %", h.faceoffPct !== null ? `${(h.faceoffPct * 100).toFixed(1)}%` : '—', a.faceoffPct !== null ? `${(a.faceoffPct * 100).toFixed(1)}%` : '—'],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Overview");

  // 2. Full Game Log
  const logHeader = ["Period", "Team", "Event", "Player #", "Zone", "Notes"];
  const logRows = data.events.sort((x, y) => x.timestamp - y.timestamp).map(e => [
    e.period,
    e.team === Team.HOME ? data.homeName : data.awayName,
    e.type,
    e.playerNumber || "N/A",
    e.zone,
    e.metadata?.notes || ""
  ]);
  const wsLog = XLSX.utils.aoa_to_sheet([logHeader, ...logRows]);
  XLSX.utils.book_append_sheet(wb, wsLog, "Game Log");

  // 3 & 4. Full player stats, both teams
  const statsHeader = ["Number", "Name", "Position", "Goals", "Assists", "Points", "Shots on Net", "Shooting %", "Hits", "PIM", "Faceoff Wins", "Faceoff Losses", "Faceoff %", "Blocks", "+/-"];
  const statsRow = (r: ReturnType<typeof buildPlayerStats>[number]) => {
    const foTotal = r.faceoffWins + r.faceoffLosses;
    return [
      r.number, r.name, r.position, r.goals, r.assists, r.goals + r.assists, r.shotsOnNet,
      r.shotsOnNet > 0 ? `${((r.goals / r.shotsOnNet) * 100).toFixed(1)}%` : '—',
      r.hits, r.penalties, r.faceoffWins, r.faceoffLosses,
      foTotal > 0 ? `${((r.faceoffWins / foTotal) * 100).toFixed(1)}%` : '—',
      r.blocks, r.plusMinus,
    ];
  };
  const wsHomeStats = XLSX.utils.aoa_to_sheet([statsHeader, ...h.rows.filter(r => r.total > 0).map(statsRow)]);
  XLSX.utils.book_append_sheet(wb, wsHomeStats, `${data.homeName.slice(0, 20)} Stats`);
  const wsAwayStats = XLSX.utils.aoa_to_sheet([statsHeader, ...a.rows.filter(r => r.total > 0).map(statsRow)]);
  XLSX.utils.book_append_sheet(wb, wsAwayStats, `${data.awayName.slice(0, 20)} Stats`);

  // 5. Goaltending
  const goalieHeader = ["Team", "Number", "Name", "Shots Against", "Goals Against", "Saves", "Save %"];
  const goalieRows = [...h.goalieStints.map(g => [data.homeName, g.number, g.name, g.shotsAgainst, g.goalsAgainst, g.saves, svPct(g.savePct)]),
                       ...a.goalieStints.map(g => [data.awayName, g.number, g.name, g.shotsAgainst, g.goalsAgainst, g.saves, svPct(g.savePct)])];
  if (goalieRows.length > 0) {
    const wsGoalies = XLSX.utils.aoa_to_sheet([goalieHeader, ...goalieRows]);
    XLSX.utils.book_append_sheet(wb, wsGoalies, "Goaltending");
  }

  // 6. Zone Play & Special Teams
  const zoneData = [
    ["ZONE PLAY & SPECIAL TEAMS", ""],
    ["", ""],
    ["STATISTIC", data.homeName, data.awayName],
    ["Zone Entries — Carry", h.zonePlay?.carry ?? 0, a.zonePlay?.carry ?? 0],
    ["Zone Entries — Dump", h.zonePlay?.dump ?? 0, a.zonePlay?.dump ?? 0],
    ["Zone Entries — Pass", h.zonePlay?.pass ?? 0, a.zonePlay?.pass ?? 0],
    ["Zone Entries — Denied", h.zonePlay?.denied ?? 0, a.zonePlay?.denied ?? 0],
    ["Dump-in Retrieval %", pct(h.zonePlay?.retrievalPct ?? null), pct(a.zonePlay?.retrievalPct ?? null)],
    ["Breakout Success %", pct(h.zonePlay?.breakoutPct ?? null), pct(a.zonePlay?.breakoutPct ?? null)],
    ["Power Play Shots", h.ppShots, a.ppShots],
    ["Penalty Kill Shots Against", h.pkShots, a.pkShots],
  ];
  const wsZone = XLSX.utils.aoa_to_sheet(zoneData);
  XLSX.utils.book_append_sheet(wb, wsZone, "Zone Play");

  XLSX.writeFile(wb, `TopCheeseHockey-Data-${data.homeName}-vs-${data.awayName}.xlsx`);
}
