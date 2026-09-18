import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Each CHL league's HockeyTech/LeagueStat client code, public API key, and
// the season_id for the CURRENT 2026-27 REGULAR season specifically —
// preseason has its own separate season_id (87 for OHL), so asking for
// this one structurally excludes preseason games rather than filtering
// them out after the fact. These values will need updating once a
// season ends and the league assigns new season_ids for the next one.
const LEAGUES = {
  ohl: { clientCode: 'ohl', apiKey: 'f1aa699db3d81487', seasonId: '88' },
  whl: { clientCode: 'whl', apiKey: 'f1aa699db3d81487', seasonId: '294' },
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

    for (const g of games) {
      const gameDate = g.date_played || g.Date || g.game_date || null;
      if (!gameDate) { failures += 1; continue; }
      if (gameDate < todayStr) { skippedPast += 1; continue; }

      const homeId = String(g.home_team ?? g.HomeID ?? '');
      const awayId = String(g.visiting_team ?? g.VisitorID ?? '');
      const homeTeam = teamNames[homeId] || g.home_team_name || g.HomeLongName || `Team ${homeId}`;
      const awayTeam = teamNames[awayId] || g.visiting_team_name || g.VisitorLongName || `Team ${awayId}`;
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
    });
  } catch (err) {
    console.error('Schedule sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
