import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@clerk/backend';

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Mirrors SCHEDULE_SYNC_EMAILS in data/adminConfig.ts on the frontend —
// kept as a separate copy here since this file can't import from the
// frontend bundle. Deliberately much narrower than the app's general
// admin list (which controls paywall bypass for a number of people) —
// this one specifically controls who can trigger a schedule import,
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

// Bulk-saves a manually entered schedule (from the Excel template) into
// the same league_games table the CHL sync writes to — this is the
// fallback path for any league without a confirmed clean API, which is
// most Ontario minor hockey associations (each runs its own separate
// platform, several confirmed different from each other already).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server is not configured for database writes (missing service role key).' });
  }

  const auth = await verifyAdminCaller(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const games = req.body?.games;
  if (!Array.isArray(games) || games.length === 0) {
    return res.status(400).json({ error: 'No games provided.' });
  }

  let upserted = 0;
  let skipped = 0;
  let failures = 0;

  for (const g of games) {
    const leagueBase = String(g.league || '').trim().toLowerCase();
    const ageGroup = String(g.ageGroup || '').trim().toLowerCase();
    const gameDate = String(g.date || '').trim();
    const homeTeam = String(g.homeTeam || '').trim();
    const awayTeam = String(g.awayTeam || '').trim();

    if (!leagueBase || !gameDate || !homeTeam || !awayTeam) {
      skipped += 1;
      continue;
    }

    // Age group folds into the league identifier itself (e.g. "gthl-u18")
    // rather than a new column — every other part of the app already
    // filters and displays purely by this one "league" string, so this
    // needs no schema change and leaves leagues with no age split (OHL,
    // WHL, QMJHL) working exactly as before.
    const league = ageGroup ? `${leagueBase}-${ageGroup}` : leagueBase;

    // No real external game ID exists for a manually entered schedule —
    // build a stable one from the game's own identifying details, so
    // re-importing the same spreadsheet later updates existing rows
    // instead of duplicating them.
    const externalGameId = `manual-${league}-${gameDate}-${homeTeam}-${awayTeam}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');

    const { error } = await supabaseAdmin
      .from('league_games')
      .upsert(
        {
          league,
          external_game_id: externalGameId,
          game_date: gameDate,
          game_datetime: null,
          home_team: homeTeam,
          away_team: awayTeam,
          venue: g.venue ? String(g.venue).trim() : null,
          venue_location: null,
          home_logo: null,
          away_logo: null,
          status: null,
        },
        { onConflict: 'league,external_game_id' }
      );

    if (error) {
      failures += 1;
      console.error('Import failed for game', externalGameId, error);
    } else {
      upserted += 1;
    }
  }

  return res.status(200).json({ success: true, upserted, skipped, failures });
}
