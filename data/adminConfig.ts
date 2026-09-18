// ============================================================
// adminConfig.ts
// The single source of truth for who counts as an admin on the
// frontend — imported by both App.tsx (for Pro-feature bypass)
// and ScoutingHub.tsx (for showing schedule sync/import
// controls), so there's exactly one list to update, not two that
// can silently drift apart. The backend endpoints that actually
// enforce this (api/sync-chl-schedule.js, api/import-league-
// games.js) keep their own copy, since they can't import
// frontend files — keep both in sync when this list changes.
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
];
