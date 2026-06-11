import { GameEvent, EventType, Team, TeamStats, Player } from '../types';
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

interface ExportData {
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  events: GameEvent[];
  stats: { home: TeamStats; away: TeamStats };
  summaries: Record<string, string>;
  maxPeriod: number;
}

const getEventColor = (type: EventType) => {
  switch (type) {
    case EventType.GOAL: return '#22c55e';
    case EventType.SHOT: return '#ffffff';
    case EventType.PP_SHOT_FOR: return '#eab308';
    case EventType.PP_SHOT_AGAINST: return '#ec4899';
    case EventType.TURNOVER: return '#f97316';
    case EventType.PENALTY: return '#ef4444';
    case EventType.HIT: return '#64748b';
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
    <svg viewBox="0 0 ${rinkWidth} ${rinkHeight}" style="width:100%; height:auto; background:#111; border-radius:40px; border:2px solid #333;">
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

export async function downloadPDFReport(data: ExportData) {
  const dateStr = new Date().toLocaleDateString();
  const timeStr = new Date().toLocaleTimeString();

  let periodSections = '';
  for (let p = 1; p <= data.maxPeriod; p++) {
    const pEvents = data.events.filter(e => e.period === p);
    if (pEvents.length === 0 && p > 1) continue;
    
    periodSections += `
      <section class="period-section" style="margin-bottom: 60px; page-break-inside: avoid;">
        <h2 style="font-size: 18px; text-transform: uppercase; border-left: 4px solid #111; padding-left: 10px; margin-bottom: 15px;">${getPeriodLabel(p)} Period Analytics</h2>
        <div style="margin-bottom: 15px;">
          ${renderRinkSVG(pEvents)}
        </div>
        <div style="background: #f4f4f4; padding: 20px; border-radius: 15px; border: 1px solid #ddd; font-size: 12px; white-space: pre-line;">
          <strong>Tactical Summary:</strong><br/>
          ${data.summaries[p] || "No AI tactical analysis generated for this period."}
        </div>
      </section>
    `;
  }

  const reportContainer = document.createElement('div');
  reportContainer.style.position = 'absolute';
  reportContainer.style.left = '-9999px';
  reportContainer.style.top = '0';
  reportContainer.style.width = '800px'; // Fixed width for consistent rendering
  
  reportContainer.innerHTML = `
    <div style="font-family: 'Inter', sans-serif; padding: 40px; color: #111; background: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid #111; padding-bottom: 20px; margin-bottom: 40px;">
        <div>
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; text-transform: uppercase;">Top Cheese Hockey Scouting Report</h1>
          <p style="margin: 5px 0 0; font-size: 12px; font-weight: 700; color: #666;">${data.homeName} vs ${data.awayName}</p>
        </div>
        <div style="text-align: right; font-size: 10px; font-weight: 700; color: #999;">
          DATE: ${dateStr}<br/>KICKOFF: ${timeStr}
        </div>
      </div>

      <div style="display: flex; gap: 20px; margin-bottom: 40px;">
        <div style="flex: 1; padding: 20px; background: #f8f8f8; border-radius: 15px; text-align: center;">
          <div style="font-size: 10px; font-weight: 900; color: #666; text-transform: uppercase;">${data.homeName}</div>
          <div style="font-size: 48px; font-weight: 900;">${data.stats.home.goals}</div>
        </div>
        <div style="flex: 1; padding: 20px; background: #f8f8f8; border-radius: 15px; text-align: center;">
          <div style="font-size: 10px; font-weight: 900; color: #666; text-transform: uppercase;">${data.awayName}</div>
          <div style="font-size: 48px; font-weight: 900;">${data.stats.away.goals}</div>
        </div>
      </div>

      <h2 style="font-size: 18px; text-transform: uppercase; border-left: 4px solid #111; padding-left: 10px; margin-bottom: 20px;">Game Overview</h2>
      <div style="background: #fdfdfd; padding: 20px; border-radius: 15px; border: 1px dashed #ccc; font-size: 13px; line-height: 1.6; margin-bottom: 40px;">
        ${data.summaries['total']}
      </div>

      ${periodSections}
    </div>
  `;

  document.body.appendChild(reportContainer);

  const opt = {
    margin: 0,
    filename: `TopCheeseHockey-Report-${data.homeName}-vs-${data.awayName}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  try {
    // html2pdf can be a function or have a default property depending on how it's bundled
    const exporter = typeof html2pdf === 'function' ? html2pdf : (html2pdf as any).default;
    if (exporter) {
      await exporter().set(opt).from(reportContainer).save();
    } else {
      console.error("html2pdf library not found or incorrectly imported");
    }
  } catch (err) {
    console.error("PDF Generation Error:", err);
  } finally {
    document.body.removeChild(reportContainer);
  }
}

export function downloadHTMLExport(data: ExportData) {
  const dateStr = new Date().toLocaleDateString();
  const timeStr = new Date().toLocaleTimeString();

  let periodSections = '';
  for (let p = 1; p <= data.maxPeriod; p++) {
    const pEvents = data.events.filter(e => e.period === p);
    if (pEvents.length === 0 && p > 1) continue;
    
    periodSections += `
      <section class="period-section" style="margin-bottom: 60px;">
        <h2 style="font-size: 18px; text-transform: uppercase; border-left: 4px solid #111; padding-left: 10px; margin-bottom: 15px;">${getPeriodLabel(p)} Period Analytics</h2>
        <div style="margin-bottom: 15px;">
          ${renderRinkSVG(pEvents)}
        </div>
        <div style="background: #f4f4f4; padding: 20px; border-radius: 15px; border: 1px solid #ddd; font-size: 12px; white-space: pre-line;">
          <strong>Tactical Summary:</strong><br/>
          ${data.summaries[p] || "No AI tactical analysis generated for this period."}
        </div>
      </section>
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Top Cheese Hockey Report - ${data.homeName} vs ${data.awayName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: #f0f2f5; color: #111; line-height: 1.5; }
        .container { max-width: 900px; margin: 40px auto; background: #fff; padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        @media print {
          body { background: #fff; }
          .container { margin: 0; padding: 20px; width: 100%; max-width: none; border-radius: 0; box-shadow: none; }
        }
        h1, h2 { margin-top: 0; }
        svg { display: block; max-width: 100%; height: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid #111; padding-bottom: 20px; margin-bottom: 40px;">
          <div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 900; text-transform: uppercase;">Top Cheese Hockey Scouting Report</h1>
            <p style="margin: 5px 0 0; font-size: 12px; font-weight: 700; color: #666;">${data.homeName} vs ${data.awayName}</p>
          </div>
          <div style="text-align: right; font-size: 10px; font-weight: 700; color: #999;">
            DATE: ${dateStr}<br/>KICKOFF: ${timeStr}
          </div>
        </div>

        <div style="display: flex; gap: 20px; margin-bottom: 40px;">
          <div style="flex: 1; padding: 20px; background: #f8f8f8; border-radius: 15px; text-align: center;">
            <div style="font-size: 10px; font-weight: 900; color: #666; text-transform: uppercase;">${data.homeName}</div>
            <div style="font-size: 48px; font-weight: 900;">${data.stats.home.goals}</div>
          </div>
          <div style="flex: 1; padding: 20px; background: #f8f8f8; border-radius: 15px; text-align: center;">
            <div style="font-size: 10px; font-weight: 900; color: #666; text-transform: uppercase;">${data.awayName}</div>
            <div style="font-size: 48px; font-weight: 900;">${data.stats.away.goals}</div>
          </div>
        </div>

        <h2 style="font-size: 18px; text-transform: uppercase; border-left: 4px solid #111; padding-left: 10px; margin-bottom: 20px;">Game Overview</h2>
        <div style="background: #fdfdfd; padding: 20px; border-radius: 15px; border: 1px dashed #ccc; font-size: 13px; line-height: 1.6; margin-bottom: 40px;">
          ${data.summaries['total']}
        </div>

        ${periodSections}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TopCheeseHockey-Report-${data.homeName}-vs-${data.awayName}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadExcelReport(data: ExportData) {
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryData = [
    ["PUKKPULSE GAME SUMMARY", ""],
    ["Date", new Date().toLocaleDateString()],
    ["Teams", `${data.homeName} vs ${data.awayName}`],
    ["", ""],
    ["STATISTIC", data.homeName, data.awayName],
    ["Goals", data.stats.home.goals, data.stats.away.goals],
    ["Shots", data.stats.home.shots, data.stats.away.shots],
    ["Faceoff Wins", data.stats.home.faceoffWins, data.events.filter(e => e.team === Team.AWAY && e.type === EventType.FACEOFF_WIN).length],
    ["PIM", data.stats.home.pim, data.events.filter(e => e.team === Team.AWAY && e.type === EventType.PENALTY).length * 2],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Overview");

  // 2. Full Game Log
  const logHeader = ["Period", "Time", "Team", "Event", "Player #", "Zone", "Notes"];
  const logRows = data.events.sort((a,b) => a.timestamp - b.timestamp).map(e => [
    e.period,
    e.gameTime,
    e.team === Team.HOME ? data.homeName : data.awayName,
    e.type,
    e.playerNumber || "N/A",
    e.zone,
    e.metadata?.notes || ""
  ]);
  const wsLog = XLSX.utils.aoa_to_sheet([logHeader, ...logRows]);
  XLSX.utils.book_append_sheet(wb, wsLog, "Game Log");

  // 3. Home Roster
  const homeRosterHeader = ["Number", "Name", "Position"];
  const homeRosterRows = data.stats.home.roster.map(p => [p.number, p.name, p.position]);
  const wsHomeRoster = XLSX.utils.aoa_to_sheet([homeRosterHeader, ...homeRosterRows]);
  XLSX.utils.book_append_sheet(wb, wsHomeRoster, `${data.homeName.slice(0, 20)} Roster`);

  // 4. Away Roster
  const awayRosterHeader = ["Number", "Name", "Position"];
  const awayRosterRows = data.stats.away.roster.map(p => [p.number, p.name, p.position]);
  const wsAwayRoster = XLSX.utils.aoa_to_sheet([awayRosterHeader, ...awayRosterRows]);
  XLSX.utils.book_append_sheet(wb, wsAwayRoster, `${data.awayName.slice(0, 20)} Roster`);

  XLSX.writeFile(wb, `TopCheeseHockey-Data-${data.homeName}-vs-${data.awayName}.xlsx`);
}

/** 
 * Legacy support for HTML, but redirected to PDF by default as requested. 
 * We keep the interface similar to maintain compatibility with App.tsx calls.
 */
export async function downloadGameReport(data: ExportData) {
  return downloadPDFReport(data);
}
