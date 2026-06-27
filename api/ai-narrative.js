export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { homeName, awayName, homeStats, awayStats, periodFilter, richData } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured' });
  const period = periodFilter === 'total' ? 'full game so far' : `period ${periodFilter}`;

  // Which team the coach using this app is actually with — tailors the advice
  // to their perspective. Falls back to a neutral summary if not provided
  // (e.g. older clients that haven't sent myTeam yet).
  const myTeamSide = richData?.myTeam; // 'HOME' | 'AWAY' | undefined
  const myTeamName = richData?.myTeamName;
  const opponentTeamName = richData?.opponentTeamName;
  const hasMyTeam = Boolean(myTeamSide && myTeamName && opponentTeamName);

  // Build a strict data summary — only what we actually have
  const hq = richData?.homeShotQuality;
  const aq = richData?.awayShotQuality;
  const hfz = richData?.homeFaceoffZones;
  const afz = richData?.awayFaceoffZones;
  const goals = richData?.goals || [];
  const dataBlock = `
TRACKED DATA FOR ${period.toUpperCase()} — ONLY USE THESE NUMBERS, DO NOT INVENT ANY OTHER STATISTICS:
${homeName}:
- Goals: ${homeStats.goals} | Shots: ${homeStats.shots} | Hits: ${homeStats.hits} | Penalties: ${homeStats.penaltiesCount} | Blocks: ${homeStats.blocks}
- Faceoffs: ${homeStats.faceoffWins}W / ${homeStats.faceoffLosses}L${homeStats.faceoffWins + homeStats.faceoffLosses > 0 ? ` (${Math.round(homeStats.faceoffWins / (homeStats.faceoffWins + homeStats.faceoffLosses) * 100)}%)` : ''}
${hfz ? `- Faceoffs by zone: O-Zone ${hfz.offensiveWins}W/${hfz.offensiveLosses}L | Neutral ${hfz.neutralWins}W/${hfz.neutralLosses}L | D-Zone ${hfz.defensiveWins}W/${hfz.defensiveLosses}L` : ''}
${hq ? `- Shot quality: ${hq.high} high danger | ${hq.medium} medium danger | ${hq.low} low danger` : ''}
${awayName}:
- Goals: ${awayStats.goals} | Shots: ${awayStats.shots} | Hits: ${awayStats.hits} | Penalties: ${awayStats.penaltiesCount} | Blocks: ${awayStats.blocks}
- Faceoffs: ${awayStats.faceoffWins}W / ${awayStats.faceoffLosses}L${awayStats.faceoffWins + awayStats.faceoffLosses > 0 ? ` (${Math.round(awayStats.faceoffWins / (awayStats.faceoffWins + awayStats.faceoffLosses) * 100)}%)` : ''}
${afz ? `- Faceoffs by zone: O-Zone ${afz.offensiveWins}W/${afz.offensiveLosses}L | Neutral ${afz.neutralWins}W/${afz.neutralLosses}L | D-Zone ${afz.defensiveWins}W/${afz.defensiveLosses}L` : ''}
${aq ? `- Shot quality: ${aq.high} high danger | ${aq.medium} medium danger | ${aq.low} low danger` : ''}
${goals.length > 0 ? `Goals scored:\n${goals.map(g => `- ${g.team} goal by ${g.player}${g.line ? ` (${g.line})` : ''}${g.quality ? ` from ${g.quality} danger` : ''}`).join('\n')}` : 'No goals scored yet.'}`;

  const perspectiveInstructions = hasMyTeam
    ? `You are advising the bench staff of ${myTeamName}. ${opponentTeamName} is the opponent.
- Write every adjustment from ${myTeamName}'s point of view — tell their coach what THEY should do, not a neutral comparison of both teams.
- When ${opponentTeamName} is doing something well (e.g. winning faceoffs, generating high-danger chances), frame it as a problem ${myTeamName} needs to counter or exploit — never as advice directed at ${opponentTeamName}.
- Do not give tactical instructions to ${opponentTeamName}. They are not your audience.`
    : `You are providing a neutral, balanced analysis of this game for someone who is not coaching either side (e.g. a broadcaster, scout, or fan tracking the game).
- Give an even-handed read on both teams — don't favor ${homeName} or ${awayName}.
- Frame points as observations about what's happening in the game, not as instructions directed at one bench.`;

  const prompt = `${perspectiveInstructions}

STRICT RULES:
- Only reference the statistics provided below. Do not mention zone entries, zone exits, possession, Corsi, expected goals, or any metric not in the data.
- Do not say "based on available data" or similar hedging phrases.
- Be direct, specific, and tactical.
- Use only ${homeName} and ${awayName} as team names.
- Format as 3-4 bullet points, max 160 words total.
${dataBlock}

Provide 3-4 specific, actionable observations about this game${hasMyTeam ? ` to help ${myTeamName}'s bench win it` : ''}.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      return res.status(200).json({ error: `API error ${response.status}: ${errText}` });
    }
    const data = await response.json();
    if (data.error) return res.status(200).json({ error: data.error.message });

    const text = data.content?.[0]?.text || 'Could not generate analysis.';
    return res.status(200).json({ narrative: text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
