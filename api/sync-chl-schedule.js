import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Only OHL for now — WHL and QMJHL can be added here once OHL is
// confirmed working, since they use the exact same chl.ca structure.
const LEAGUE_URLS = {
  ohl: 'https://chl.ca/ohl/schedule/',
};

// The schedule page returns full HTML, not clean JSON — the game data
// sits embedded inside it as a plain JSON object starting with
// {"league":"ohl",... This walks forward from that starting point,
// tracking whether we're inside a quoted string (so braces that appear
// inside team names, URLs, etc. don't get miscounted), until the braces
// balance back out to find the object's real closing brace.
function extractJsonObject(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }
  return null;
}

async function fetchLeagueSchedule(league) {
  const url = LEAGUE_URLS[league];
  if (!url) throw new Error(`Unsupported league: ${league}`);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TopCheeseHockey/1.0)' },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${league} schedule: ${response.status}`);

  const html = await response.text();
  const anchor = '{"league":"';
  const startIndex = html.indexOf(anchor);
  if (startIndex === -1) throw new Error(`Could not find schedule data in the ${league} page — chl.ca may have changed its page structure.`);

  const jsonText = extractJsonObject(html, startIndex);
  if (!jsonText) throw new Error(`Found the start of ${league} schedule data but could not extract a complete JSON object.`);

  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`${league} schedule data was found but isn't valid JSON: ${err.message}`);
  }

  return Array.isArray(data.scoreboard) ? data.scoreboard : [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server is not configured for database writes (missing service role key).' });
  }

  const league = (req.body?.league || 'ohl').toLowerCase();

  try {
    const games = await fetchLeagueSchedule(league);

    let upserted = 0;
    let failures = 0;
    for (const g of games) {
      const { error } = await supabaseAdmin
        .from('league_games')
        .upsert(
          {
            league,
            external_game_id: String(g.ID),
            game_date: g.Date,
            game_datetime: g.GameDateISO8601 || null,
            home_team: g.HomeLongName,
            away_team: g.VisitorLongName,
            venue: g.venue_name || null,
            venue_location: g.venue_location || null,
            home_logo: g.HomeLogo || null,
            away_logo: g.VisitorLogo || null,
            status: g.GameStatusString || null,
          },
          { onConflict: 'league,external_game_id' }
        );
      if (error) {
        failures += 1;
        console.error('Upsert failed for game', g.ID, error);
      } else {
        upserted += 1;
      }
    }

    return res.status(200).json({
      success: true,
      league,
      gamesFound: games.length,
      upserted,
      failures,
    });
  } catch (err) {
    console.error('Schedule sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
