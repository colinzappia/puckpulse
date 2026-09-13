// Site-wide feature flags that need to match everywhere they're checked —
// following the same shared-file pattern as companyInfo.js, manualContent.js,
// and goalieNet.ts in this folder: a single value that must stay consistent
// gets extracted here instead of copy-pasted, so it can't drift.

// Ad banners (top/bottom of the app) and the "Advertise With Us" page/nav
// links are switched off while building up the paid user base. Flip this
// one value back to `true` to bring both back on everywhere at once.
export const ADS_ENABLED = false;
