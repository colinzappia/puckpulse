export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { homeName, awayName, homeStats, awayStats, periodFilter } = req.body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured' });

  const period = periodFilter === 'total' ? 'full game' : `period ${periodFilter}`;

  const prompt = `You are an expert hockey analyst and coach. Based on the following ${period} statistics, provide tactical coaching insights in 3-4 concise bullet points. Focus on actionable adjustments the coach can make right now.

${homeName}: ${homeStats.goals}G, ${homeStats.shots}S, ${homeStats.faceoffWins}FW, ${homeStats.faceoffLosses}FL, ${homeStats.hits}HIT, ${homeStats.penaltiesCount}PEN, ${homeStats.blocks}BLK
${awayName}: ${awayStats.goals}G, ${awayStats.shots}S, ${awayStats.faceoffWins}FW, ${awayStats.faceoffLosses}FL, ${awayStats.hits}HIT, ${awayStats.penaltiesCount}PEN, ${awayStats.blocks}BLK

Be specific, direct, and tactical. Use hockey terminology. Keep it under 150 words total.`;

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

    const data = await response.json();
    const text = data.content?.[0]?.text || 'Could not generate analysis.';
    return res.status(200).json({ narrative: text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
