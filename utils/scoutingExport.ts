// ============================================================
// scoutingExport.ts
// Turns a scouting report (game-tied or standalone) into a
// downloadable PDF or clipboard text for emailing. PDF
// generation reuses the same html2pdf.js technique as
// services/exportService.ts — render the report off-screen,
// then capture it — so no new library is introduced here.
//
// "Email" copies the report text to the clipboard rather than
// relying only on a mailto: link — mailto silently does nothing
// on any device without a default mail app configured, which is
// the common case on desktop (Gmail/Outlook used in-browser, no
// native mail app set as default). A mailto: attempt still fires
// as a bonus for the minority who do have one set up.
// ============================================================

import { ScoutRatings } from '../services/scoutingReportService';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const RATING_LABELS: Record<keyof ScoutRatings, string> = {
  skating: 'Skating',
  shot: 'Shot',
  puckSkills: 'Puck skills',
  playmaking: 'Playmaking',
  ozHockeySense: 'OZ hockey sense',
  dzHockeySense: 'DZ hockey sense',
  compete: 'Compete',
  physicality: 'Physicality',
};

// Same design tokens as services/exportService.ts, kept local here since
// that file doesn't export them — just for visual consistency between
// the two PDF types.
const INK = '#0f172a';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export interface ScoutingExportData {
  playerName: string;
  meta: string; // e.g. "#17 · C · Ottawa 67's" or "Midget AAA · Sep 12, 2026"
  stats?: { label: string; value: string }[]; // omitted entirely for standalone reports
  ratings: ScoutRatings;
  notes: string;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildScoutingReportText(data: ScoutingExportData): string {
  const lines: string[] = [];
  lines.push(`Scouting Report: ${data.playerName}`);
  lines.push(data.meta);
  lines.push('');
  if (data.stats && data.stats.length > 0) {
    lines.push('Tracked stats:');
    data.stats.forEach(s => lines.push(`  ${s.label}: ${s.value}`));
    lines.push('');
  }
  lines.push('Ratings (1-10):');
  (Object.keys(RATING_LABELS) as (keyof ScoutRatings)[]).forEach(key => {
    const val = data.ratings[key];
    lines.push(`  ${RATING_LABELS[key]}: ${val !== undefined ? val : '—'}`);
  });
  lines.push('');
  lines.push('Notes:');
  lines.push(data.notes || '(none)');
  return lines.join('\n');
}

function buildScoutingReportHTML(data: ScoutingExportData): string {
  const dateStr = new Date().toLocaleDateString();
  const statsRows = (data.stats || [])
    .map(s => `<tr><td style="padding:7px 10px; border-bottom:1px solid ${BORDER};">${escapeHtml(s.label)}</td><td style="padding:7px 10px; text-align:right; font-weight:700; border-bottom:1px solid ${BORDER};">${escapeHtml(s.value)}</td></tr>`)
    .join('');
  const ratingRows = (Object.keys(RATING_LABELS) as (keyof ScoutRatings)[])
    .map(key => `<tr><td style="padding:7px 10px; border-bottom:1px solid ${BORDER};">${RATING_LABELS[key]}</td><td style="padding:7px 10px; text-align:right; font-weight:900; border-bottom:1px solid ${BORDER};">${data.ratings[key] ?? '—'}</td></tr>`)
    .join('');

  return `
    <div style="font-family: ${FONT}; color: ${INK}; padding: 36px; width: 640px; background:#fff;">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:5px solid ${INK}; padding-bottom:18px; margin-bottom:24px;">
        <div>
          <p style="margin:0 0 4px; font-size:10px; font-weight:900; letter-spacing:0.15em; color:${MUTED}; text-transform:uppercase;">🏒 Top Cheese Hockey</p>
          <h1 style="margin:0; font-size:22px; font-weight:900;">Scouting Report</h1>
        </div>
        <div style="text-align:right; font-size:10px; font-weight:700; color:${MUTED};">${dateStr}</div>
      </div>

      <h2 style="margin:0 0 2px; font-size:20px; font-weight:900;">${escapeHtml(data.playerName)}</h2>
      <p style="margin:0 0 24px; font-size:12px; color:${MUTED}; font-weight:600;">${escapeHtml(data.meta)}</p>

      ${data.stats && data.stats.length > 0 ? `
      <h3 style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; border-left:4px solid ${INK}; padding-left:8px; margin:0 0 10px;">Tracked stats</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:24px;">${statsRows}</table>` : ''}

      <h3 style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; border-left:4px solid ${INK}; padding-left:8px; margin:0 0 10px;">Ratings (1&ndash;10)</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:24px;">${ratingRows}</table>

      <h3 style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; border-left:4px solid ${INK}; padding-left:8px; margin:0 0 10px;">Notes</h3>
      <div style="background:#f8fafc; border:1px solid ${BORDER}; border-radius:10px; padding:14px; font-size:12px; line-height:1.6; white-space:pre-wrap;">${escapeHtml(data.notes) || '(none)'}</div>
    </div>`;
}

// Same hidden-wrapper technique as downloadPDFReport in exportService.ts:
// html2canvas measures a position:fixed/absolute element as zero-height
// when cloning the document, so the report is hidden via a zero-height
// overflow:hidden wrapper instead, keeping its own layout completely
// normal while off-screen.
export async function downloadScoutingReportPDF(data: ScoutingExportData) {
  const reportContainer = document.createElement('div');
  reportContainer.style.width = '680px';
  reportContainer.style.background = '#fff';
  reportContainer.innerHTML = buildScoutingReportHTML(data);

  const hiddenWrapper = document.createElement('div');
  hiddenWrapper.style.height = '0';
  hiddenWrapper.style.overflow = 'hidden';
  hiddenWrapper.appendChild(reportContainer);
  document.body.appendChild(hiddenWrapper);

  const opt = {
    margin: 0,
    filename: `TopCheeseHockey-ScoutingReport-${data.playerName.replace(/[^a-z0-9]+/gi, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
  };

  try {
    const exporter = typeof html2pdf === 'function' ? html2pdf : (html2pdf as any).default;
    if (!exporter) throw new Error('PDF library failed to load — try refreshing the page.');
    await exporter().set(opt).from(reportContainer).save();
  } catch (err: any) {
    console.error('Scouting report PDF generation error:', err);
    throw new Error(err?.message || 'Could not generate the PDF. Please try again.');
  } finally {
    document.body.removeChild(hiddenWrapper);
  }
}

// Copies the report to the clipboard (the reliable path) and also fires a
// mailto: link as a bonus for anyone who does have a default mail app set
// up — harmless no-op for everyone else. Returns whether the clipboard
// copy actually succeeded, so the caller can tell the user what happened.
export async function emailScoutingReport(data: ScoutingExportData): Promise<boolean> {
  const subject = `Scouting Report: ${data.playerName}`;
  const body = buildScoutingReportText(data);

  let copied = false;
  try {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    copied = true;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    copied = false;
  }

  try {
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  } catch {
    // Ignore — this is a bonus attempt, the clipboard copy above is the
    // real fallback.
  }

  return copied;
}
