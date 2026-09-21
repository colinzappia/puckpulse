// ============================================================
// adminConfig.ts
// The single source of truth for who counts as an admin on the
// frontend — imported by App.tsx for Pro-feature bypass and
// paywall access. The backend endpoints that enforce the same
// list (api/sync-chl-schedule.js, api/import-league-games.js —
// though see SCHEDULE_SYNC_EMAILS below, which they actually use
// now) keep their own copy, since they can't import frontend
// files — keep both in sync when this list changes.
// ============================================================

export const ADMIN_EMAILS = [
  'colinzappia@gmail.com',
  'derekfroats19@gmail.com',
  'macopelo17@gmail.com',
  'marcodinardo24@gmail.com',
  'mmcnamee12@hotmail.com',
  'codycaron@cunet.carleton.ca',
  'shahbazimel@gmail.com',
  'patrick.grandmaitre@uottawa.ca',
  'patrickdelislehoude@cunet.carleton.ca',
  'jboyd@ontariohockeyleague.com',
  'boydjam@gmail.com',
  'andrewmercer@rogers.com',
  'pstoykewych@ottawa67s.com',
  'barber.hockey@outlook.com',
  'abbottnhl@gmail.com',
  'lennyzappia@gmail.com',
  'turpinliam@gmail.com',
  'puckbunker@gmail.com',
];

// A separate, much narrower list — just for who can trigger a league
// schedule sync or Excel import. Deliberately not the same list as
// ADMIN_EMAILS above: that list controls paywall bypass and Pro
// features for a number of people (colleagues, family, others), and
// removing someone from it would cut off their free access to the
// whole app, not just schedule syncing. This list exists so schedule
// access can be restricted independently, without touching that.
export const SCHEDULE_SYNC_EMAILS = [
  'colinzappia@gmail.com',
];
