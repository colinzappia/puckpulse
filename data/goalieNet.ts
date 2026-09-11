// Shared source of truth for the Goalie Hub net image's geometry —
// imported by BOTH components/GoalieHub.tsx (the live tap UI) and
// services/exportService.ts (the PDF/HTML report's net-chart renderer),
// following the same shared-data-file pattern as companyInfo.js and
// manualContent.js in this folder: content that must stay consistent in
// multiple places gets extracted here instead of duplicated.
//
// This file exists because it USED to be duplicated — exportService.ts
// had its own copy of these six numbers with a different (wrong) frame
// rectangle, so a shot that correctly landed outside the net on the live
// page could render as if it were inside the net in the exported report.
// Keeping one copy makes that class of bug impossible to reintroduce.

// The net image's natural pixel dimensions — GoalieHub's <svg viewBox>
// and exportService's SVG canvas both derive from these.
export const NET_IMG_W = 1408;
export const NET_IMG_H = 768;

// The actual net frame's boundary within the image, measured directly
// from the red frame's pixel bounds. A tap landing outside this box
// missed the net entirely — it shouldn't count as a shot faced (or
// affect save percentage) any more than a real shot sailing wide would.
export const NET_X_MIN = 286;
export const NET_X_MAX = 1121;
export const NET_Y_MIN = 94;
export const NET_Y_MAX = 623;

export function isOnNet(x: number, y: number): boolean {
  return x >= NET_X_MIN && x <= NET_X_MAX && y >= NET_Y_MIN && y <= NET_Y_MAX;
}

// A plain-language zone label for a tap's position — used to make raw
// x/y coordinates (in Excel exports, say) readable without picturing the
// pixel grid. Split into thirds the same way the visual gridlines in
// both the live diagram and the exported chart already divide the net.
export function describeNetZone(x: number, y: number): string {
  if (!isOnNet(x, y)) {
    const vertical = y < NET_Y_MIN ? 'High' : y > NET_Y_MAX ? 'Low' : '';
    const horizontal = x < NET_X_MIN ? 'Wide Left' : x > NET_X_MAX ? 'Wide Right' : '';
    const parts = [vertical, horizontal].filter(Boolean);
    return parts.length > 0 ? `Missed Net (${parts.join(', ')})` : 'Missed Net';
  }
  const col = (x - NET_X_MIN) / (NET_X_MAX - NET_X_MIN);
  const row = (y - NET_Y_MIN) / (NET_Y_MAX - NET_Y_MIN);
  const horizontal = col < 1 / 3 ? 'Left' : col > 2 / 3 ? 'Right' : 'Center';
  const vertical = row < 1 / 3 ? 'Top' : row > 2 / 3 ? 'Low' : 'Mid';
  return `${vertical} ${horizontal}`;
}
