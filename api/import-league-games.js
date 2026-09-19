import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Mirrors data/adminConfig.ts on the frontend — kept as a separate copy
// here since this file can't import from the frontend bundle. Update
// both together if this list ever changes.
const ADMIN_EMAILS = [
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

// Confirms the request actually came from a signed-in admin — checking
// only in the UI isn't real security, since anyone who finds this URL
// could call it directly, bypassing the app entirely. Two steps:
// (1) the bearer token is verified as a genuine, currently-valid Clerk
// session via Supabase (which already trusts Clerk for this, from the
// same integration RLS relies on) — this can't be faked by the caller.
// (2) Clerk's default session token doesn't include email, only a user
// ID, so that verified ID is looked up against Clerk's own servers
// (server-to-server, using the account's secret key) to get the real
// email, which is then checked against the admin list. Nothing here
// trusts anything the browser itself claims about who it is.
async function verifyAdminCaller(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === 'null' || token === 'undefined') {
    return { ok: false, status: 401, error: `No valid sign-in token was sent with this request (got: "${token || '(empty)'}").` };
  }

  if (!process.env.VITE_SUPABASE_ANON_KEY) {
    return { ok: false, status: 500, error: 'Server is not configured to verify sign-in (missing anon key).' };
  }
  const supabaseAuth = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return { ok: false, status: 401, error: `Sign-in token did not validate: ${authError?.message || 'no user returned'}.` };
  }

  if (!process.env.CLERK_SECRET_KEY) {
    return { ok: false, status: 500, error: 'Server is not configured to verify admin access (missing Clerk secret key).' };
  }
  const clerkRes = await fetch(`https://api.clerk.com/v1/users/${authData.user.id}`, {
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
  });
  if (!clerkRes.ok) {
    return { ok: false, status: 401, error: `Could not verify your account with Clerk (status ${clerkRes.status}).` };
  }
  const clerkUser = await clerkRes.json();
  const primary = clerkUser.email_addresses?.find(e => e.id === clerkUser.primary_email_address_id);
  const email = (primary?.email_address || clerkUser.email_addresses?.[0]?.email_address || '').toLowerCase();

  if (!ADMIN_EMAILS.includes(email)) {
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
