export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 
  const { teamName, pasteText, rosterUrl: rawRosterUrl, imageBase64, imageMediaType } = req.body;
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
    : imageBase64
      ? `You are a hockey roster parser. The attached image is a photo or screenshot of a team's game-day lineup sheet. These sheets typically have TWO separate parts, often side by side:
(1) A roster list — jersey numbers and player names.
(2) A separate "Lines and Defensemen Duos" (or similarly labeled) table showing forward lines (Line 1-5, with LW/C/RW columns) and defense pairings (Def 1-4, with LD/RD columns), by jersey number — plus sometimes a goalie Starting/Substitute row.

Read the image carefully — it may be photographed at an angle, have glare, or be handwritten. A player's name struck through means they're scratched/not dressed — exclude them entirely.

Do this in two explicit steps. Do not skip step 1 or merge it into step 2 — the lines/pairings table has small text in a dense grid, and reading it as its own careful pass (rather than while also cross-referencing the roster) is what prevents mismatches.

STEP 1 — Transcribe the lines/pairings table exactly as printed, cell by cell, into a "linesTable" field structured like this, using null for any genuinely empty cell:
{"line1":{"LW":"12","C":"29","RW":"34"},"line2":{"LW":"11","C":"37","RW":"17"},"line3":{...},"line4":{...},"line5":{...},"def1":{"LD":"8","RD":"23"},"def2":{...},"def3":{...},"def4":{...},"goalie":{"starting":"1","substitute":"32"}}
Include every line/def row visible, even if some cells in it are empty (use null for those specific cells only).

STEP 2 — Build the player list using ONLY the linesTable you just transcribed in step 1 to assign position and line, matching each roster player's jersey number against it:
- Number matches a Line row's LW/C/RW cell → position is LW/C/RW accordingly, "line" is that row's number as a string (line2 → "2").
- Number matches a Def row's LD/RD cell → position is "D", "line" is "P" plus that row's number (def1 → "P1").
- Number matches the goalie starting/substitute → position is "G", "line" is "G1" for starting, "G2" for substitute.
- Number appears on the roster but does not match anywhere in your own linesTable → position "F", line "1" as a fallback. If you find yourself using this fallback for more than one or two players, stop and re-check step 1 — it likely means a transcription mistake there, not that those players are truly unlisted.

Extract every dressed player belonging to "${teamName}" (if the image shows more than one team, only extract "${teamName}" — ignore the opposing team's roster). Extract jersey number and full name for every player. If jersey number missing use "00". No duplicates. ${NAME_RULE} ${NUMBER_RULE}

Respond with ONLY valid JSON, no markdown, no explanation. Include your step 1 linesTable so it's clear which cells you actually read: {"status":"OK","linesTable":{"line1":{"LW":"12","C":"29","RW":"34"}},"players":[{"number":"15","name":"Player Name","position":"C","line":"1"}]}`
    : isPdfUrl
      ? `You are a hockey roster parser. The attached document is a team's game-day lineup sheet. These sheets typically have TWO separate parts: (1) a roster list of jersey numbers and player names, and (2) a separate "Lines and Defensemen Duos" (or similarly labeled) table showing forward lines (Line 1-5, with LW/C/RW columns) and defense pairings (Def 1-4, with LD/RD columns), by jersey number — plus sometimes a goalie Starting/Substitute row. A player's name struck through means they're scratched/not dressed — exclude them entirely.

Extract every dressed player belonging to "${teamName}" (if the document lists more than one team, only extract "${teamName}" — ignore the opposing team's roster).

For EACH player, determine their real position and line by finding their jersey number in the lines/pairings table — do not guess or distribute players evenly:
- Number appears under LW, C, or RW for a specific Line row → position is LW/C/RW accordingly, "line" is that row's number as a string (Line 2 → "2").
- Number appears under LD or RD for a specific Def row → position is "D", "line" is "P" plus that row's number (Def 1 → "P1").
- Number appears in a goalie Starting/Substitute row → position is "G", "line" is "G1" for starting, "G2" for substitute/backup.
- Number is on the roster but never appears anywhere in the lines/pairings table → position "F", line "1" as a reasonable default the coach can correct later.

Extract jersey number and full name for every player. No duplicates. ${NAME_RULE} ${NUMBER_RULE}
Respond with ONLY valid JSON, no markdown, no explanation: {"status":"OK","players":[{"number":"15","name":"Player Name","position":"C","line":"1"}]}`
      : `You are a hockey roster expert. Find the current roster for the "${teamName}" hockey team. Extract all players with their jersey number, full name, and position (C, LW, RW, D, or G). Assign lines: forwards to 1-4, defense to P1-P3, goalies to G1-G2. ${NAME_RULE}
Respond with ONLY valid JSON, no markdown, no explanation: {"status":"OK","players":[{"number":"15","name":"Player Name","position":"C","line":"1"}]}`;
 
  // When we have an actual PDF to read, or a photographed/screenshotted
  // roster image, attach it directly as a document/image block so the
  // model reads the real source instead of guessing from general
  // knowledge (which is what was happening before — rosterUrl was being
  // captured but never actually sent to the AI).
  const content = imageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: imageMediaType || 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: promptText }
      ]
    : isPdfUrl
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
        model: (isPdfUrl || imageBase64) ? 'claude-sonnet-4-5' : 'claude-haiku-4-5',
        max_tokens: 3000,
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
