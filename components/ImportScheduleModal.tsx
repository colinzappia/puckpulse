// ============================================================
// ImportScheduleModal.tsx
// Bulk-imports a league's schedule from an Excel file — the
// fallback for any league without a confirmed clean API to sync
// from, which is most Ontario minor hockey associations (each
// runs its own separate platform, at least two already confirmed
// different from each other). Expects the same template this
// screen offers a download link for: League, Age Group, Date,
// Home Team, Away Team, Venue — one row per game.
// ============================================================

import React, { useState } from 'react';
import * as XLSX from 'xlsx';

interface Props {
  getToken: () => Promise<string | null>;
  onClose: () => void;
}

interface ParsedGame {
  league: string;
  ageGroup: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
}

// Handles a real Excel date-type cell (unchanged from before), and now
// also pulls the date portion out of a text value even when a time is
// attached — confirmed against real files: a cell typed with a time
// (e.g. "9/20/2026 7:00 PM") doesn't always get recognized as a proper
// date-type cell, and the old version just passed that whole messy
// string through unparsed as game_date, which then silently never
// matched a clean "2026-09-20" comparison anywhere else in the app —
// games with a time attached were quietly vanishing from every
// date-filtered view because of this, not because of anything wrong
// with the games themselves.
function excelDateToISO(val: any): string {
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val || '').trim();
  if (!str) return '';

  // Already clean "YYYY-MM-DD", optionally with a time after it.
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // "M/D/YYYY" or "MM/DD/YYYY", optionally with a time after it.
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;

  // Last resort — JS's own flexible parser (handles things like "Sept
  // 20, 2026 7:00 PM"); only trusted if it actually produced a real
  // date, not NaN.
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  // Genuinely unparseable — returned as-is so the existing "no complete
  // rows found" validation below catches it during preview, rather
  // than silently guessing wrong.
  return str;
}

export default function ImportScheduleModal({ getToken, onClose }: Props) {
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedGame[]>([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ upserted: number; skipped: number; failures: number } | null>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    setResult(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

        // Row 0 is the header — everything after is data.
        const games: ParsedGame[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          const [league, ageGroup, date, homeTeam, awayTeam, venue] = row;
          const leagueStr = String(league || '').trim();
          const homeStr = String(homeTeam || '').trim();
          const awayStr = String(awayTeam || '').trim();
          const dateStr = excelDateToISO(date);
          // Skips incomplete rows and the template's own example rows
          // once League/Date/Home/Away are all required — same check
          // the backend repeats, so a row that somehow makes it past
          // this client-side filter still can't be saved incomplete.
          if (!leagueStr || !dateStr || !homeStr || !awayStr) continue;
          games.push({
            league: leagueStr,
            ageGroup: String(ageGroup || '').trim(),
            date: dateStr,
            homeTeam: homeStr,
            awayTeam: awayStr,
            venue: String(venue || '').trim(),
          });
        }

        if (games.length === 0) {
          setParseError('No complete rows found — make sure League, Date, Home Team, and Away Team are filled in for each game.');
        }
        setParsed(games);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Could not read that file — make sure it's a real .xlsx file.");
        setParsed([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/import-league-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ games: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed.');
      setResult({ upserted: data.upserted, skipped: data.skipped, failures: data.failures });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 370, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' },
    panel: { position: 'fixed' as const, inset: 0, zIndex: 371, background: '#070a0f', display: 'flex', flexDirection: 'column' as const },
    topbar: { background: '#0c1018', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    body: { flex: 1, overflowY: 'auto' as const, padding: 16 },
    btn: (color = '#60a5fa') => ({ padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `0.5px solid ${color}40`, background: `${color}12`, color, width: '100%' } as React.CSSProperties),
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        <div style={S.topbar}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Import league schedule</span>
          <span onClick={onClose} style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</span>
        </div>
        <div style={S.body}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16, lineHeight: 1.6 }}>
            Upload a filled-in copy of the schedule template — one row per game, with League, Date, Home Team, and Away Team filled in. Age Group and Venue are optional; leave them blank if they don't apply.
          </div>

          <label
            style={{ display: 'block', textAlign: 'center', padding: 20, borderRadius: 10, fontSize: 12, fontWeight: 700, border: '1.5px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginBottom: 16 }}
          >
            {fileName ? `📄 ${fileName}` : '📊 Choose an Excel file (.xlsx)'}
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0] || null)}
            />
          </label>

          {parseError && (
            <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              {parseError}
            </div>
          )}

          {parsed.length > 0 && !result && (
            <>
              <div style={{ fontSize: 13, color: '#34d399', fontWeight: 700, marginBottom: 12 }}>
                Found {parsed.length} game{parsed.length !== 1 ? 's' : ''} ready to import.
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' as const, marginBottom: 16, border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                {parsed.slice(0, 50).map((g, i) => (
                  <div key={i} style={{ padding: '8px 12px', borderBottom: i < Math.min(parsed.length, 50) - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ color: '#60a5fa', fontWeight: 700 }}>{g.league.toUpperCase()}{g.ageGroup ? ` ${g.ageGroup.toUpperCase()}` : ''}</span> — {g.homeTeam} vs {g.awayTeam} — {g.date}
                  </div>
                ))}
                {parsed.length > 50 && (
                  <div style={{ padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                    …and {parsed.length - 50} more
                  </div>
                )}
              </div>
              <button style={S.btn('#34d399')} onClick={handleImport} disabled={importing}>
                {importing ? 'Importing…' : `Import ${parsed.length} game${parsed.length !== 1 ? 's' : ''}`}
              </button>
            </>
          )}

          {result && (
            <div style={{ fontSize: 13, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '0.5px solid rgba(52,211,153,0.3)', borderRadius: 10, padding: 14 }}>
              Done — saved {result.upserted} game{result.upserted !== 1 ? 's' : ''}
              {result.skipped > 0 && `, skipped ${result.skipped} incomplete row${result.skipped !== 1 ? 's' : ''}`}
              {result.failures > 0 && `, ${result.failures} failed`}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
