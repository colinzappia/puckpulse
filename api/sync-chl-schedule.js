import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@clerk/backend';

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Mirrors SCHEDULE_SYNC_EMAILS in data/adminConfig.ts on the frontend —
// kept as a separate copy here since this file can't import from the
// frontend bundle. Deliberately much narrower than the app's general
// admin list (which controls paywall bypass for a number of people) —
// this one specifically controls who can trigger a schedule sync,
// independent of that. Update both together if this ever changes.
const SCHEDULE_SYNC_EMAILS = [
  'colinzappia@gmail.com',
];

// Confirms the request actually came from a signed-in admin — checking
// only in the UI isn't real security, since anyone who finds this URL
// could call it directly, bypassing the app entirely.
//
// This verifies the token directly with Clerk (verifyToken, from
// Clerk's own backend SDK), rather than through Supabase's auth
// service — an earlier version tried routing through
// supabase.auth.getUser(), which failed, because that path expects
// Supabase's own natively-signed tokens (a different algorithm) and
// doesn't inherit the Third-Party Auth trust that only applies to
// database-level (RLS) requests, not the separate Supabase Auth
// service. Clerk's own SDK is the correct tool for verifying Clerk's
// own tokens.
//
// Clerk's default session token doesn't include email, only a user
// ID, so once the token's identity is confirmed, that ID is looked up
// against Clerk's own servers (server-to-server, using the account's
// secret key) to get the real email, checked against the admin list.
// Nothing here trusts anything the browser itself claims about who it is.
async function verifyAdminCaller(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === 'null' || token === 'undefined') {
    return { ok: false, status: 401, error: `No valid sign-in token was sent with this request (got: "${token || '(empty)'}").` };
  }

  if (!process.env.CLERK_SECRET_KEY) {
    return { ok: false, status: 500, error: 'Server is not configured to verify admin access (missing Clerk secret key).' };
  }

  let payload;
  try {
    payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
  } catch (err) {
    return { ok: false, status: 401, error: `Sign-in token did not validate: ${err.message}.` };
  }

  const clerkRes = await fetch(`https://api.clerk.com/v1/users/${payload.sub}`, {
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
  });
  if (!clerkRes.ok) {
    return { ok: false, status: 401, error: `Could not verify your account with Clerk (status ${clerkRes.status}).` };
  }
  const clerkUser = await clerkRes.json();
  const primary = clerkUser.email_addresses?.find(e => e.id === clerkUser.primary_email_address_id);
  const email = (primary?.email_address || clerkUser.email_addresses?.[0]?.email_address || '').toLowerCase();

  if (!SCHEDULE_SYNC_EMAILS.includes(email)) {
    return { ok: false, status: 403, error: 'Admin access required.' };
  }
  return { ok: true, email };
}

// Each CHL league's HockeyTech/LeagueStat client code, public API key, and
// the season_id for the CURRENT 2026-27 REGULAR season specifically —
// preseason has its own separate season_id (87 for OHL), so asking for
// this one structurally excludes preseason games rather than filtering
// them out after the fact. These values will need updating once a
// season ends and the league assigns new season_ids for the next one.
const LEAGUES = {
  ohl: { clientCode: 'ohl', apiKey: 'f1aa699db3d81487', seasonId: '88' },
  // WHL's season_id was previously set to 294, based on that value
  // showing up on games close to the season's start — but 294 turned
  // out to be a narrow, mostly-preseason window (confirmed: syncing it
  // only ever returned 56 games clustered before the season's actual
  // September 18 start). 295 is confirmed instead, via five different
  // WHL team schedule pages that are explicitly titled "2026-27
  // Regular Season Schedule" and use 295 in their own URLs — including
  // one showing a real game on September 19, the day after the season
  // began.
  whl: { clientCode: 'whl', apiKey: 'f1aa699db3d81487', seasonId: '295' },
  // QMJHL's actual internal client code is "lhjmq" (its French acronym) —
  // kept as "qmjhl" everywhere in our own data and UI, since that's what
  // scouts actually call it; the lhjmq mapping only matters for this one
  // API call.
  qmjhl: { clientCode: 'lhjmq', apiKey: 'f1aa699db3d81487', seasonId: '214' },
};

const HOCKEYTECH_BASE = 'https://lscluster.hockeytech.com/feed/index.php';

async function fetchHockeyTech(params) {
  const url = `${HOCKEYTECH_BASE}?${new URLSearchParams(params).toString()}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TopCheeseHockey/1.0)' },
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON but got something else back (first 200 chars): ${text.slice(0, 200)}`);
  }
}

// Field names for this endpoint aren't directly confirmed for OHL, only
// inferred from a documented sibling league on the same platform — so
// this tries several plausible shapes rather than assuming one.
function buildTeamNameMap(teamsResponse) {
  const list = Array.isArray(teamsResponse) ? teamsResponse
    : Array.isArray(teamsResponse?.SiteKit?.Teamsbyseason) ? teamsResponse.SiteKit.Teamsbyseason
    : Array.isArray(teamsResponse?.teams) ? teamsResponse.teams
    : [];
  const map = {};
  for (const t of list) {
    const id = t.id ?? t.team_id ?? t.ID;
    const name = t.name || t.team_name || t.nickname || t.full_name
      || (t.city && t.nickname ? `${t.city} ${t.nickname}` : null);
    if (id !== undefined && name) map[String(id)] = name;
  }
  return map;
}

function extractGamesArray(scheduleResponse) {
  if (Array.isArray(scheduleResponse)) return scheduleResponse;
  if (Array.isArray(scheduleResponse?.SiteKit?.Schedule)) return scheduleResponse.SiteKit.Schedule;
  if (Array.isArray(scheduleResponse?.data)) return scheduleResponse.data;
  return [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server is not configured for database writes (missing service role key).' });
  }

  // A scheduled GitHub Action can trigger this same sync automatically,
  // carrying this shared secret instead of a real signed-in session —
  // there's no user to verify in that case, only a value only the
  // Action and this server both know. Manual use from Scouts Portal
  // (a real admin, signed in) still goes through the normal check below.
  const cronSecret = req.headers['x-cron-secret'];
  const isCron = process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

  if (!isCron) {
    const auth = await verifyAdminCaller(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
  }

  const league = (req.body?.league || 'ohl').toLowerCase();
  const config = LEAGUES[league];
  if (!config) {
    return res.status(400).json({ error: `Unsupported league: ${league}` });
  }

  try {
    const [teamsResponse, scheduleResponse] = await Promise.all([
      fetchHockeyTech({ feed: 'modulekit', view: 'teamsbyseason', season_id: config.seasonId, key: config.apiKey, client_code: config.clientCode }),
      fetchHockeyTech({ feed: 'modulekit', view: 'schedule', season_id: config.seasonId, key: config.apiKey, client_code: config.clientCode }),
    ]);

    const teamNames = buildTeamNameMap(teamsResponse);
    const games = extractGamesArray(scheduleResponse);

    // If nothing came back, don't fail silently or save garbage — report
    // exactly what the response actually looked like so field-name
    // guesses can be corrected quickly instead of debugged blind.
    if (games.length === 0) {
      return res.status(200).json({
        success: false,
        league,
        gamesFound: 0,
        message: 'The schedule request returned no games. The response shape may differ from what was expected — check rawSample below.',
        rawSample: JSON.stringify(scheduleResponse).slice(0, 800),
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    let upserted = 0;
    let skippedPast = 0;
    let failures = 0;
    // Tracks the actual date span of everything the API returned,
    // regardless of whether each game got saved or skipped — this is
    // what actually reveals a narrow-window problem like the one this
    // was built to catch: "found 56 games" looks like partial success
    // until you see they're all clustered in a 10-day span instead of
    // spanning the real ~7-month season.
    let earliestFound = null;
    let latestFound = null;

    for (const g of games) {
      const gameDate = g.date_played || g.Date || g.game_date || null;
      if (!gameDate) { failures += 1; continue; }
      if (!earliestFound || gameDate < earliestFound) earliestFound = gameDate;
      if (!latestFound || gameDate > latestFound) latestFound = gameDate;
      if (gameDate < todayStr) { skippedPast += 1; continue; }

      const homeId = String(g.home_team ?? g.HomeID ?? '');
      const awayId = String(g.visiting_team ?? g.VisitorID ?? '');
      // QMJHL names teams "City, Team Name" (e.g. "Baie-Comeau, Drakkar") —
      // OHL and WHL don't do this, so it's fixed only for this one league
      // rather than stripping commas from every team name generally,
      // which could accidentally mangle a name that legitimately has one.
      const cleanTeamName = (name) => (league === 'qmjhl' ? name.replace(/,\s*/g, ' ') : name);
      const homeTeam = cleanTeamName(teamNames[homeId] || g.home_team_name || g.HomeLongName || `Team ${homeId}`);
      const awayTeam = cleanTeamName(teamNames[awayId] || g.visiting_team_name || g.VisitorLongName || `Team ${awayId}`);
      const gameId = String(g.game_id ?? g.ID ?? g.id ?? `${gameDate}-${homeId}-${awayId}`);

      const { error } = await supabaseAdmin
        .from('league_games')
        .upsert(
          {
            league,
            external_game_id: gameId,
            game_date: gameDate,
            game_datetime: g.schedule_time ? `${gameDate}T${g.schedule_time}` : (g.GameDateISO8601 || null),
            home_team: homeTeam,
            away_team: awayTeam,
            venue: g.venue_name || g.location_name || null,
            venue_location: g.venue_location || null,
            home_logo: g.HomeLogo || null,
            away_logo: g.VisitorLogo || null,
            status: g.status_string || g.GameStatusString || null,
          },
          { onConflict: 'league,external_game_id' }
        );
      if (error) {
        failures += 1;
        console.error('Upsert failed for game', gameId, error);
      } else {
        upserted += 1;
      }
    }

    return res.status(200).json({
      success: true,
      league,
      gamesFound: games.length,
      upserted,
      skippedPast,
      failures,
      dateRangeFound: earliestFound && latestFound ? `${earliestFound} to ${latestFound}` : null,
    });
  } catch (err) {
    console.error('Schedule sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
