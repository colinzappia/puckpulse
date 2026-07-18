export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 
  const { teamName, pasteText, rosterUrl: rawRosterUrl } = req.body;
  if (!teamName) return res.status(400).json({ status: 'ERROR', reason: 'Team name required' });
 
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ status: 'ERROR', reason: 'AI service not configured - missing API key' });
 
  // Chrome's built-in PDF viewer (and some other browser extensions) wrap
  // the real URL as chrome-extension://<id>/<real-url> when copied from the
  // address bar. Unwrap that so we fetch the actual document, not a local
  // extension path the server can't reach.
  const rosterUrl = rawRosterUrl?.includes('chrome-extension://')
    ? rawRosterUrl.replace(/^chrome-extension:\/\/[a-z]+\//i, '')
    : rawRosterUrl;
  const isPdfUrl = !!rosterUrl && /\.pdf(\?|#|$)/i.test(rosterUrl);
 
  const NAME_RULE = `Name format: always output names as "First Last" (first name first). If the source text has names as "Last, First" (e.g. "Smith, John"), flip them to "First Last" (e.g. "John Smith") in your output — never keep the "Last, First" order.`;
  const NUMBER_RULE = `Jersey number: use ONLY each player's actual jersey/sweater number. Many lineup sheets also show a row number or lineup order (1, 2, 3, 4... simply counting down the list) in a separate column from the real jersey number (often labeled "#" or "No.", and NOT sequential — it can be any value and players are not necessarily listed in ascending jersey-number order). Never use the row/list position as the jersey number — only the number actually worn on the sweater.`;
 
  const promptText = pasteText
    ? `You are a hockey roster parser. Extract ALL players from the following pasted roster text for the team "${teamName}".
RULES: Only extract players from the text below. Extract jersey number, full name, and position for each player. Position: map to C, LW, RW, D, or G only. Line assignment: Forwards get 1,2,3,4. Defense get P1,P2,P3. Goalies get G1,G2. If jersey number missing use "00". No duplicates. ${NAME_RULE} ${NUMBER_RULE}
PASTED TEXT:
${pasteText}
Respond with ONLY valid JSON, no markdown, no explanation: {"status":"OK","players":[{"number":"15","name":"Player Name","position":"C","line":"1"}]}`
    : isPdfUrl
      ? `You are a hockey roster parser. The attached document is a roster or game lineup sheet. Extract ALL players belonging to "${teamName}" (if the document lists more than one team, only extract players from "${teamName}" — ignore the opposing team). Extract each player's jersey number, full name, and position. Position: map to C, LW, RW, D, or G only. Line assignment: Forwards get 1,2,3,4. Defense get P1,P2,P3. Goalies get G1,G2. No duplicates. ${NAME_RULE} ${NUMBER_RULE}
Respond with ONLY valid JSON, no markdown, no explanation: {"status":"OK","players":[{"number":"15","name":"Player Name","position":"C","line":"1"}]}`
      : `You are a hockey roster expert. Find the current roster for the "${teamName}" hockey team. Extract all players with their jersey number, full name, and position (C, LW, RW, D, or G). Assign lines: forwards to 1-4, defense to P1-P3, goalies to G1-G2. ${NAME_RULE}
Respond with ONLY valid JSON, no markdown, no explanation: {"status":"OK","players":[{"number":"15","name":"Player Name","position":"C","line":"1"}]}`;
 
  // When we have an actual PDF to read, attach it directly as a document
  // block so the model reads the real file instead of guessing from
  // general knowledge (which is what was happening before — rosterUrl was
  // being captured but never actually sent to the AI).
  const content = isPdfUrl
    ? [
        { type: 'document', source: { type: 'url', url: rosterUrl } },
        { type: 'text', text: promptText }
      ]
    : promptText;
 
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: isPdfUrl ? 'claude-sonnet-4-5' : 'claude-haiku-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content }]
      })
    });
 
    if (!response.ok) {
      const errText = await response.text();
      return res.status(200).json({ status: 'ERROR', players: [], reason: `API error ${response.status}: ${errText}` });
    }
 
    const data = await response.json();
    
    if (data.error) {
      return res.status(200).json({ status: 'ERROR', players: [], reason: `Anthropic error: ${data.error.message}` });
    }
 
    const text = data.content?.[0]?.text || '';
    if (!text) return res.status(200).json({ status: 'ERROR', players: [], reason: 'Empty response from AI' });
 
    // Try to parse JSON from response
    let parsed = null;
    // Strip markdown code blocks if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { parsed = JSON.parse(cleaned); } catch {}
    if (!parsed) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[0]); } catch {} }
    }
 
    if (!parsed || !parsed.players) {
      return res.status(200).json({ status: 'ERROR', players: [], reason: `Could not parse response: ${text.substring(0, 200)}` });
    }
 
    return res.status(200).json({ status: 'OK', players: parsed.players, sources: [] });
  } catch (err) {
    return res.status(200).json({ status: 'ERROR', players: [], reason: `Exception: ${err.message}` });
  }
}
 
